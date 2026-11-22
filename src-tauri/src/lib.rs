use std::path::PathBuf;

mod files;

#[tauri::command]
async fn read_text_file(path: PathBuf) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || files::read_text(&path))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn write_text_file(path: PathBuf, contents: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || files::write_text_atomic(&path, &contents))
        .await
        .map_err(|error| error.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_text_file, write_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
