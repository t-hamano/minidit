//! Reading and writing files.

use std::fs;
use std::io::{ErrorKind, Read, Write};
use std::path::Path;

/// Files larger than this are not opened.
pub const MAX_FILE_SIZE: u64 = 50 * 1024 * 1024;

/// Reads a file to open in the editor, refusing files over the size limit.
pub fn read_bytes(path: &Path) -> Result<Vec<u8>, String> {
    let describe = |error: std::io::Error| describe_io_error(path, &error);
    let file = fs::File::open(path).map_err(describe)?;
    let size = file.metadata().map_err(describe)?.len();
    if size > MAX_FILE_SIZE {
        return Err(too_large(path));
    }
    let mut bytes = Vec::with_capacity(size as usize);
    // Guards against a file that grows while it is read.
    file.take(MAX_FILE_SIZE + 1)
        .read_to_end(&mut bytes)
        .map_err(describe)?;
    if bytes.len() as u64 > MAX_FILE_SIZE {
        return Err(too_large(path));
    }
    Ok(bytes)
}

fn too_large(path: &Path) -> String {
    format!(
        "\"{}\" is larger than {} MB and can't be opened.",
        display_name(path),
        MAX_FILE_SIZE / 1024 / 1024
    )
}

/// Writes a file without corrupting the original if saving fails
/// partway through: the contents go to a temporary file in the same folder,
/// which then replaces the original.
pub fn write_atomic(path: &Path, contents: &[u8]) -> Result<(), String> {
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
    temp.write_all(contents).map_err(describe)?;
    temp.as_file().sync_all().map_err(describe)?;
    if let Some(permissions) = permissions {
        fs::set_permissions(temp.path(), permissions).map_err(describe)?;
    }
    temp.persist(path).map_err(|error| describe(error.error))?;
    Ok(())
}

pub fn display_name(path: &Path) -> String {
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
        write_atomic(&path, b"hello\nworld").unwrap();
        assert_eq!(read_bytes(&path).unwrap(), b"hello\nworld");
    }

    #[test]
    fn overwrites_existing_file_and_leaves_no_temp_files() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("memo.txt");
        fs::write(&path, "old").unwrap();
        write_atomic(&path, b"new").unwrap();
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

        assert!(write_atomic(&path, b"new").is_err());
        assert_eq!(fs::read_to_string(&path).unwrap(), "original");
        assert_eq!(fs::read_dir(dir.path()).unwrap().count(), 1);
    }

    #[test]
    fn reports_missing_file() {
        let dir = tempfile::tempdir().unwrap();
        let error = read_bytes(&dir.path().join("missing.txt")).unwrap_err();
        assert_eq!(error, "\"missing.txt\" could not be found.");
    }

    #[test]
    fn refuses_files_over_the_size_limit() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("big.txt");
        fs::File::create(&path)
            .unwrap()
            .set_len(MAX_FILE_SIZE + 1)
            .unwrap();
        assert_eq!(
            read_bytes(&path).unwrap_err(),
            "\"big.txt\" is larger than 50 MB and can't be opened."
        );
    }
}
