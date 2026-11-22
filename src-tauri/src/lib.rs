use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{AppHandle, Manager, State};
use text::{Encoding, LineEnding};

mod browser_shortcuts;
mod files;
mod fonts;
#[cfg(target_os = "macos")]
mod macos_quit;
mod open_files;
mod settings;
mod text;
mod watcher;

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
async fn read_text_file(
    app: AppHandle,
    path: PathBuf,
    encoding: Option<Encoding>,
) -> Result<OpenedFile, String> {
    run_blocking(
        move || {
            let bytes = app
                .state::<watcher::FileWatcher>()
                .read(&path, || files::read_bytes(&path))?;
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
    app: AppHandle,
    path: PathBuf,
    contents: String,
    encoding: Encoding,
    line_ending: LineEnding,
) -> Result<(), SaveError> {
    run_blocking(
        move || {
            let bytes = text::encode(&contents, encoding, line_ending)
                .map_err(|_| SaveError::Unrepresentable)?;
            app.state::<watcher::FileWatcher>()
                .save(&path, || files::write_atomic(&path, &bytes))
                .map_err(SaveError::Io)
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

/// Watches the open files for changes by other apps.
#[tauri::command]
fn watch_files(app: AppHandle, watcher: State<'_, watcher::FileWatcher>, paths: Vec<PathBuf>) {
    watcher.watch(&app, paths);
}

/// Called once the window is ready to open files. Returns the files that
/// were waiting, such as those named on the command line.
#[tauri::command]
fn take_pending_files(queue: State<'_, open_files::OpenQueue>) -> Vec<PathBuf> {
    queue.take()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        // Registered first, so that a second launch exits before doing
        // anything else.
        .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {
            let paths = open_files::paths_from_args(args, Path::new(&cwd));
            app.state::<open_files::OpenQueue>().open(app, paths);
            open_files::focus_window(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .manage(open_files::OpenQueue::default())
        .manage(watcher::FileWatcher::default())
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
            if let Ok(cwd) = std::env::current_dir() {
                let paths = open_files::paths_from_args(std::env::args_os(), &cwd);
                app.state::<open_files::OpenQueue>()
                    .open(app.handle(), paths);
            }
            #[cfg(target_os = "macos")]
            macos_quit::install(app.handle());
            if let Some(window) = app.get_webview_window("main") {
                browser_shortcuts::disable(&window);
                settings::restore_window_state(app.handle(), &window);
                window.show()?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            write_text_file,
            list_fonts,
            watch_files,
            take_pending_files,
            settings::read_settings,
            settings::write_settings,
            settings::save_window_state
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application")
        .run(|app, event| {
            // Files opened from Finder, including the one that launched
            // the app.
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = event {
                let paths = urls
                    .into_iter()
                    .filter_map(|url| url.to_file_path().ok())
                    .collect();
                app.state::<open_files::OpenQueue>().open(app, paths);
                open_files::focus_window(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
