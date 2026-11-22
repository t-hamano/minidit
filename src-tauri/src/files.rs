//! Reading and writing text files.
//!
//! Only UTF-8 is supported at this stage. Encoding and line-ending handling
//! arrive in a later phase.

use std::fs;
use std::io::{ErrorKind, Write};
use std::path::Path;

/// Reads a UTF-8 text file.
pub fn read_text(path: &Path) -> Result<String, String> {
    let bytes = fs::read(path).map_err(|error| describe_io_error(path, &error))?;
    String::from_utf8(bytes)
        .map_err(|_| format!("\"{}\" is not a UTF-8 text file.", display_name(path)))
}

/// Writes a text file without corrupting the original if saving fails
/// partway through: the contents go to a temporary file in the same folder,
/// which then replaces the original.
pub fn write_text_atomic(path: &Path, contents: &str) -> Result<(), String> {
    let describe = |error: std::io::Error| describe_io_error(path, &error);
    let dir = match path.parent() {
        Some(dir) if !dir.as_os_str().is_empty() => dir,
        _ => Path::new("."),
    };

    // Keep the original file's permissions (e.g. read-only bits, or the
    // executable bit of a script on macOS).
    let permissions = match fs::metadata(path) {
        Ok(metadata) => Some(metadata.permissions()),
        Err(error) if error.kind() == ErrorKind::NotFound => None,
        Err(error) => return Err(describe(error)),
    };
    if permissions.as_ref().is_some_and(|p| p.readonly()) {
        return Err(describe(ErrorKind::PermissionDenied.into()));
    }

    let mut temp = tempfile::Builder::new()
        .prefix(".minidit-")
        .suffix(".tmp")
        .tempfile_in(dir)
        .map_err(describe)?;
    temp.write_all(contents.as_bytes()).map_err(describe)?;
    temp.as_file().sync_all().map_err(describe)?;
    if let Some(permissions) = permissions {
        fs::set_permissions(temp.path(), permissions).map_err(describe)?;
    }
    temp.persist(path).map_err(|error| describe(error.error))?;
    Ok(())
}

fn display_name(path: &Path) -> String {
    path.file_name()
        .unwrap_or(path.as_os_str())
        .to_string_lossy()
        .into_owned()
}

fn describe_io_error(path: &Path, error: &std::io::Error) -> String {
    let name = display_name(path);
    match error.kind() {
        ErrorKind::NotFound => format!("\"{name}\" could not be found."),
        ErrorKind::PermissionDenied => {
            format!("You don't have permission to access \"{name}\".")
        }
        ErrorKind::StorageFull => format!("There isn't enough disk space to save \"{name}\"."),
        _ => format!("\"{name}\" could not be accessed: {error}"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_and_reads_back() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("memo.txt");
        write_text_atomic(&path, "hello\nworld").unwrap();
        assert_eq!(read_text(&path).unwrap(), "hello\nworld");
    }

    #[test]
    fn overwrites_existing_file_and_leaves_no_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("memo.txt");
        fs::write(&path, "old").unwrap();
        write_text_atomic(&path, "new").unwrap();
        assert_eq!(fs::read_to_string(&path).unwrap(), "new");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn keeps_original_when_file_is_read_only() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("memo.txt");
        fs::write(&path, "original").unwrap();
        let mut permissions = fs::metadata(&path).unwrap().permissions();
        permissions.set_readonly(true);
        fs::set_permissions(&path, permissions).unwrap();

        assert!(write_text_atomic(&path, "new").is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "original");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn reports_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let error = read_text(&dir.path().join("missing.txt")).unwrap_err();
        assert_eq!(error, "\"missing.txt\" could not be found.");
    }

    #[test]
    fn rejects_non_utf8() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("sjis.txt");
        fs::write(&path, [0x82, 0xa0]).unwrap();
        assert!(read_text(&path).is_err());
    }
}
