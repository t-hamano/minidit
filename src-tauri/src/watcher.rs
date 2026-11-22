//! Detects when another app changes or deletes an open file.
//!
//! Each open file's size and modification time are recorded when the app
//! reads or saves it. When something changes in a folder with open files,
//! files whose size or modification time no longer match are reported, so
//! the app's own saves are not.

use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::{Duration, SystemTime};

use notify_debouncer_mini::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

/// Waits for a burst of changes, such as a save by another app, to settle.
const DEBOUNCE: Duration = Duration::from_millis(300);

pub const FILE_CHANGED_EVENT: &str = "file-changed";

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
struct Fingerprint {
    modified: Option<SystemTime>,
    len: u64,
}

/// `None` when the file does not exist.
fn fingerprint(path: &Path) -> Option<Fingerprint> {
    let metadata = fs::metadata(path)
        .ok()
        .filter(|metadata| metadata.is_file())?;
    Some(Fingerprint {
        modified: metadata.modified().ok(),
        len: metadata.len(),
    })
}

#[derive(Serialize, Clone, Debug, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct FileChange {
    path: PathBuf,
    deleted: bool,
}

#[derive(Default)]
struct Files {
    fingerprints: HashMap<PathBuf, Option<Fingerprint>>,
    folders: HashSet<PathBuf>,
}

impl Files {
    /// Updates the fingerprints and returns the files that changed.
    fn changes(&mut self) -> Vec<FileChange> {
        let mut changes = Vec::new();
        for (path, recorded) in &mut self.fingerprints {
            let current = fingerprint(path);
            if current != *recorded {
                *recorded = current;
                changes.push(FileChange {
                    path: path.clone(),
                    deleted: current.is_none(),
                });
            }
        }
        changes
    }
}

#[derive(Default)]
pub struct FileWatcher {
    files: Mutex<Files>,
    debouncer: Mutex<Option<Debouncer<RecommendedWatcher>>>,
}

impl FileWatcher {
    /// Runs a read of `path` and records the file as it was before
    /// reading, so a change made while reading is still reported.
    pub fn read<T>(&self, path: &Path, read: impl FnOnce() -> T) -> T {
        let mut files = self.files.lock().unwrap();
        let recorded = fingerprint(path);
        let result = read();
        files.fingerprints.insert(path.to_path_buf(), recorded);
        result
    }

    /// Runs a save of `path` and records the file as the app left it, so
    /// the app's own save is not reported.
    pub fn save<T>(&self, path: &Path, save: impl FnOnce() -> T) -> T {
        let mut files = self.files.lock().unwrap();
        let result = save();
        files
            .fingerprints
            .insert(path.to_path_buf(), fingerprint(path));
        result
    }

    /// Watches exactly the given files.
    pub fn watch(&self, app: &AppHandle, paths: Vec<PathBuf>) {
        let paths: HashSet<PathBuf> = paths.into_iter().collect();
        let folders: HashSet<PathBuf> = paths
            .iter()
            .filter_map(|path| path.parent().map(Path::to_path_buf))
            .collect();

        let mut files = self.files.lock().unwrap();
        files.fingerprints.retain(|path, _| paths.contains(path));
        for path in &paths {
            if !files.fingerprints.contains_key(path) {
                files.fingerprints.insert(path.clone(), fingerprint(path));
            }
        }

        let mut debouncer = self.debouncer.lock().unwrap();
        if debouncer.is_none() {
            let app = app.clone();
            *debouncer = new_debouncer(DEBOUNCE, move |result: DebounceEventResult| {
                if result.is_ok() {
                    app.state::<FileWatcher>().report_changes(&app);
                }
            })
            .ok();
        }
        let Some(debouncer) = debouncer.as_mut() else {
            return;
        };
        let watcher = debouncer.watcher();
        for folder in files.folders.difference(&folders) {
            let _ = watcher.unwatch(folder);
        }
        let mut watched = HashSet::new();
        for folder in folders {
            if files.folders.contains(&folder)
                || watcher.watch(&folder, RecursiveMode::NonRecursive).is_ok()
            {
                watched.insert(folder);
            }
        }
        files.folders = watched;
    }

    fn report_changes(&self, app: &AppHandle) {
        let changes = self.files.lock().unwrap().changes();
        for change in changes {
            let _ = app.emit(FILE_CHANGED_EVENT, change);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn files_with(path: &Path) -> Files {
        let mut files = Files::default();
        files
            .fingerprints
            .insert(path.to_path_buf(), fingerprint(path));
        files
    }

    #[test]
    fn reports_nothing_when_unchanged() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("memo.txt");
        fs::write(&path, "hello").unwrap();
        assert_eq!(files_with(&path).changes(), vec![]);
    }

    #[test]
    fn reports_a_changed_file_once() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("memo.txt");
        fs::write(&path, "hello").unwrap();
        let mut files = files_with(&path);
        fs::write(&path, "hello, world").unwrap();
        assert_eq!(
            files.changes(),
            vec![FileChange {
                path: path.clone(),
                deleted: false
            }]
        );
        assert_eq!(files.changes(), vec![]);
    }

    #[test]
    fn reports_a_deleted_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("memo.txt");
        fs::write(&path, "hello").unwrap();
        let mut files = files_with(&path);
        fs::remove_file(&path).unwrap();
        assert_eq!(
            files.changes(),
            vec![FileChange {
                path: path.clone(),
                deleted: true
            }]
        );
    }

    #[test]
    fn ignores_the_apps_own_saves() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("memo.txt");
        fs::write(&path, "hello").unwrap();
        let watcher = FileWatcher::default();
        watcher
            .files
            .lock()
            .unwrap()
            .fingerprints
            .insert(path.clone(), fingerprint(&path));
        watcher.save(&path, || {
            crate::files::write_atomic(&path, b"hello, world").unwrap()
        });
        assert_eq!(watcher.files.lock().unwrap().changes(), vec![]);
    }
}
