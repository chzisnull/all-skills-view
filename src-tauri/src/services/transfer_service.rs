use crate::services::conflict_service::{copy_path, ConflictMode, ConflictService};
use std::path::{Path, PathBuf};

pub const ERR_INVALID_ARGUMENT: &str = "InvalidArgument";
pub const ERR_PATH_NOT_FOUND: &str = "PathNotFound";
pub const ERR_CONFLICT_DETECTED: &str = "ConflictDetected";
pub const ERR_PERMISSION_DENIED: &str = "PermissionDenied";
pub const ERR_IO_FAILURE: &str = "IoFailure";

#[derive(Debug, Clone)]
pub struct TransferError {
    pub code: &'static str,
    pub message: String,
    pub details: Option<String>,
}

impl TransferError {
    fn new(code: &'static str, message: impl Into<String>, details: Option<String>) -> Self {
        Self {
            code,
            message: message.into(),
            details,
        }
    }

    fn io(message: impl Into<String>, details: Option<String>) -> Self {
        let message = message.into();
        let code = classify_io_error_code(&message);
        Self::new(code, message, details)
    }
}

pub type TransferResult<T> = Result<T, TransferError>;

#[derive(Debug, Clone)]
pub struct TransferOutcome {
    pub final_path: PathBuf,
    pub conflict_mode: Option<ConflictMode>,
}

pub struct TransferService;

impl TransferService {
    pub fn import_skill(source_path: &Path, target_root: &Path) -> TransferResult<TransferOutcome> {
        import_entry(source_path, target_root)
    }

    pub fn export_skill(
        entry_path: &Path,
        target_dir: &Path,
        conflict_mode: Option<ConflictMode>,
        rename_to: Option<&str>,
    ) -> TransferResult<TransferOutcome> {
        transfer_entry(entry_path, target_dir, conflict_mode, rename_to)
    }
}

fn transfer_entry(
    source_path: &Path,
    target_root: &Path,
    conflict_mode: Option<ConflictMode>,
    rename_to: Option<&str>,
) -> TransferResult<TransferOutcome> {
    transfer_entry_with_conflict(source_path, target_root, conflict_mode, rename_to)
}

fn import_entry(source_path: &Path, target_root: &Path) -> TransferResult<TransferOutcome> {
    if !source_path.exists() {
        return Err(TransferError::new(
            ERR_PATH_NOT_FOUND,
            format!("source path does not exist: {}", source_path.display()),
            Some(source_path.to_string_lossy().to_string()),
        ));
    }

    if !target_root.exists() || !target_root.is_dir() {
        return Err(TransferError::new(
            ERR_PATH_NOT_FOUND,
            format!("target root does not exist: {}", target_root.display()),
            Some(target_root.to_string_lossy().to_string()),
        ));
    }

    let source_name = source_path
        .file_name()
        .ok_or_else(|| {
            TransferError::new(
                ERR_INVALID_ARGUMENT,
                "source path has no filename",
                Some(source_path.to_string_lossy().to_string()),
            )
        })?
        .to_owned();

    let destination = target_root.join(source_name);
    if destination.exists() {
        return Err(TransferError::new(
            ERR_CONFLICT_DETECTED,
            "已存在，不允许复制",
            Some(destination.to_string_lossy().to_string()),
        ));
    }

    copy_path(source_path, &destination).map_err(|err| {
        TransferError::io(err.to_string(), Some(destination.display().to_string()))
    })?;

    Ok(TransferOutcome {
        final_path: destination,
        conflict_mode: None,
    })
}

fn transfer_entry_with_conflict(
    source_path: &Path,
    target_root: &Path,
    conflict_mode: Option<ConflictMode>,
    rename_to: Option<&str>,
) -> TransferResult<TransferOutcome> {
    if !source_path.exists() {
        return Err(TransferError::new(
            ERR_PATH_NOT_FOUND,
            format!("source path does not exist: {}", source_path.display()),
            Some(source_path.to_string_lossy().to_string()),
        ));
    }

    if !target_root.exists() || !target_root.is_dir() {
        return Err(TransferError::new(
            ERR_PATH_NOT_FOUND,
            format!("target root does not exist: {}", target_root.display()),
            Some(target_root.to_string_lossy().to_string()),
        ));
    }

    let source_name = source_path
        .file_name()
        .ok_or_else(|| {
            TransferError::new(
                ERR_INVALID_ARGUMENT,
                "source path has no filename",
                Some(source_path.to_string_lossy().to_string()),
            )
        })?
        .to_owned();

    let destination = target_root.join(source_name);
    if destination.exists() {
        let mode = match conflict_mode {
            Some(value) => value,
            None => {
                return Err(TransferError::new(
                    ERR_CONFLICT_DETECTED,
                    format!("target already exists: {}", destination.display()),
                    Some(destination.to_string_lossy().to_string()),
                ));
            }
        };

        let final_path = ConflictService::resolve(source_path, &destination, mode, rename_to)
            .map_err(|err| {
                TransferError::io(err.to_string(), Some(destination.display().to_string()))
            })?;

        return Ok(TransferOutcome {
            final_path,
            conflict_mode: Some(mode),
        });
    }

    copy_path(source_path, &destination).map_err(|err| {
        TransferError::io(err.to_string(), Some(destination.display().to_string()))
    })?;

    Ok(TransferOutcome {
        final_path: destination,
        conflict_mode: None,
    })
}

fn classify_io_error_code(message: &str) -> &'static str {
    let lower = message.to_lowercase();
    if lower.contains("permission denied") {
        return ERR_PERMISSION_DENIED;
    }
    if lower.contains("not found") || lower.contains("does not exist") {
        return ERR_PATH_NOT_FOUND;
    }
    ERR_IO_FAILURE
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn import_skill_copies_file_when_no_conflict() {
        let source_tmp = tempdir().expect("source tempdir");
        let source_file = source_tmp.path().join("SKILL.md");
        fs::write(&source_file, "name: demo").expect("write source");

        let target_tmp = tempdir().expect("target tempdir");
        let outcome = TransferService::import_skill(&source_file, target_tmp.path())
            .expect("import should succeed");

        assert!(outcome.final_path.exists());
        assert_eq!(
            fs::read_to_string(&outcome.final_path).expect("read copied"),
            "name: demo"
        );
        assert!(outcome.conflict_mode.is_none());
    }

    #[test]
    fn import_skill_reports_conflict_without_mode() {
        let source_tmp = tempdir().expect("source tempdir");
        let source_file = source_tmp.path().join("SKILL.md");
        fs::write(&source_file, "new").expect("write source");

        let target_tmp = tempdir().expect("target tempdir");
        let existing = target_tmp.path().join("SKILL.md");
        fs::write(&existing, "old").expect("write target");

        let result = TransferService::import_skill(&source_file, target_tmp.path());
        let error = result.expect_err("should return conflict");
        assert_eq!(error.code, ERR_CONFLICT_DETECTED);
        assert_eq!(error.message, "已存在，不允许复制");
    }

    #[test]
    fn export_skill_overwrites_when_mode_is_overwrite() {
        let source_tmp = tempdir().expect("source tempdir");
        let entry_file = source_tmp.path().join("SKILL.md");
        fs::write(&entry_file, "latest").expect("write source");

        let target_tmp = tempdir().expect("target tempdir");
        let existing = target_tmp.path().join("SKILL.md");
        fs::write(&existing, "stale").expect("write existing");

        let outcome = TransferService::export_skill(
            &entry_file,
            target_tmp.path(),
            Some(ConflictMode::Overwrite),
            None,
        )
        .expect("export should succeed");

        assert_eq!(
            fs::read_to_string(&outcome.final_path).expect("read overwritten"),
            "latest"
        );
        assert_eq!(outcome.conflict_mode, Some(ConflictMode::Overwrite));
    }

    #[test]
    fn import_skill_reports_path_not_found() {
        let target_tmp = tempdir().expect("target tempdir");
        let missing = target_tmp.path().join("missing.md");

        let result = TransferService::import_skill(&missing, target_tmp.path());
        let error = result.expect_err("should return path not found");
        assert_eq!(error.code, ERR_PATH_NOT_FOUND);
    }

    #[test]
    fn import_skill_does_not_execute_embedded_scripts() {
        let source_tmp = tempdir().expect("source tempdir");
        let source_dir = source_tmp.path().join("skill-with-script");
        let scripts_dir = source_dir.join("scripts");
        fs::create_dir_all(&scripts_dir).expect("create scripts dir");
        fs::write(source_dir.join("SKILL.md"), "name: safe-copy").expect("write skill");

        let marker = source_tmp.path().join("marker.txt");
        let script_content = format!("#!/bin/sh\necho hacked > \"{}\"\n", marker.display());
        let script_path = scripts_dir.join("post.sh");
        fs::write(&script_path, script_content).expect("write script");

        let target_tmp = tempdir().expect("target tempdir");
        let outcome = TransferService::import_skill(&source_dir, target_tmp.path())
            .expect("import should copy directory");

        assert!(outcome.final_path.exists(), "copied dir should exist");
        assert!(
            outcome.final_path.join("scripts/post.sh").exists(),
            "script should be copied only"
        );
        assert!(
            !marker.exists(),
            "marker file should not exist because script must not auto execute"
        );
    }
}
