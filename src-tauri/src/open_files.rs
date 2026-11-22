//! Files that the OS asks the app to open: command-line arguments, a second
//! launch of the app, and on macOS, files opened from Finder.

use std::ffi::OsString;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use tauri::{AppHandle, Emitter, Manager};

pub const OPEN_FILES_EVENT: &str = "open-files";

/// Holds files to open until the window is ready to receive them.
#[derive(Default)]
pub struct OpenQueue(Mutex<Queue>);

#[derive(Default)]
struct Queue {
    ready: bool,
    paths: Vec<PathBuf>,
}

impl OpenQueue {
    /// Opens files in the window, or keeps them until it is ready.
    pub fn open(&self, app: &AppHandle, paths: Vec<PathBuf>) {
        if paths.is_empty() {
            return;
        }
        let mut queue = self.0.lock().unwrap();
        if queue.ready {
            let _ = app.emit(OPEN_FILES_EVENT, paths);
        } else {
            queue.paths.extend(paths);
        }
    }

    /// Marks the window as ready and returns the files waiting to open.
    pub fn take(&self) -> Vec<PathBuf> {
        let mut queue = self.0.lock().unwrap();
        queue.ready = true;
        std::mem::take(&mut queue.paths)
    }
}

/// The files named in command-line arguments, without the program itself.
/// Relative paths are resolved against `cwd`.
pub fn paths_from_args(
    args: impl IntoIterator<Item = impl Into<OsString>>,
    cwd: &Path,
) -> Vec<PathBuf> {
    args.into_iter()
        .skip(1)
        .map(Into::into)
        // Skips options, such as `-psn_…` that older macOS versions pass.
        .filter(|arg| !arg.to_string_lossy().starts_with('-'))
        .map(|arg| cwd.join(arg))
        .collect()
}

/// Brings the window to the front.
pub fn focus_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_arguments_against_the_working_directory() {
        let cwd = Path::new("/home/aki");
        let absolute = cwd.join("notes").join("todo.md");
        assert_eq!(
            paths_from_args(
                [
                    OsString::from("minidit"),
                    OsString::from("memo.txt"),
                    absolute.clone().into_os_string(),
                ],
                cwd
            ),
            vec![cwd.join("memo.txt"), absolute]
        );
    }

    #[test]
    fn skips_options() {
        assert_eq!(
            paths_from_args(["minidit", "-psn_0_12345"], Path::new("/")),
            Vec::<PathBuf>::new()
        );
    }
}
