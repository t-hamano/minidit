use std::path::PathBuf;

use serde::Serialize;
use tauri::Manager;
use text::{Encoding, LineEnding};

mod files;
mod fonts;
mod settings;
mod text;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OpenedFile {
    /// The text with LF line endings.
    text: String,
    encoding: Encoding,
    line_ending: LineEnding,
    /// Whether some bytes could not be decoded and were replaced with
    /// U+FFFD.
    had_errors: bool,
}

#[derive(Serialize)]
#[serde(tag = "kind", content = "message", rename_all = "kebab-case")]
enum SaveError {
    /// The text has characters the encoding cannot represent.
    Unrepresentable,
    Io(String),
}

async fn run_blocking<T: Send + 'static, E: Send + 'static>(
    task: impl FnOnce() -> Result<T, E> + Send + 'static,
    join_error: impl FnOnce(String) -> E,
) -> Result<T, E> {
    tauri::async_runtime::spawn_blocking(task)
        .await
        .map_err(|error| join_error(error.to_string()))?
}

/// Reads a text file, detecting its encoding unless one is given.
#[tauri::command]
async fn read_text_file(path: PathBuf, encoding: Option<Encoding>) -> Result<OpenedFile, String> {
    run_blocking(
        move || {
            let bytes = files::read_bytes(&path)?;
            let decoded = text::decode(&bytes, encoding);
            if decoded.text.contains('\0') {
                return Err(format!(
                    "\"{}\" appears to be a binary file and can't be opened.",
                    files::display_name(&path)
                ));
            }
            Ok(OpenedFile {
                text: decoded.text,
                encoding: decoded.encoding,
                line_ending: decoded.line_ending,
                had_errors: decoded.had_errors,
            })
        },
        |error| error,
    )
    .await
}

/// Saves editor text with the given encoding and line ending.
#[tauri::command]
async fn write_text_file(
    path: PathBuf,
    contents: String,
    encoding: Encoding,
    line_ending: LineEnding,
) -> Result<(), SaveError> {
    run_blocking(
        move || {
            let bytes = text::encode(&contents, encoding, line_ending)
                .map_err(|_| SaveError::Unrepresentable)?;
            files::write_atomic(&path, &bytes).map_err(SaveError::Io)
        },
        SaveError::Io,
    )
    .await
}

/// Lists the installed font families, for the font setting.
#[tauri::command]
async fn list_fonts() -> Result<Vec<String>, String> {
    run_blocking(|| Ok(fonts::installed_families()), |error| error).await
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(settings::SettingsLock::default())
        .manage(settings::NormalBounds::default())
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) = event {
                if let Some(webview_window) = window.app_handle().get_webview_window(window.label())
                {
                    settings::track_normal_bounds(
                        &webview_window,
                        &window.app_handle().state::<settings::NormalBounds>(),
                    );
                }
            }
        })
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                settings::restore_window_state(app.handle(), &window);
                window.show()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            list_fonts,
            settings::read_settings,
            settings::write_settings,
            settings::save_window_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
