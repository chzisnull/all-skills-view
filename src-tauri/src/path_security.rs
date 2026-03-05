use anyhow::{anyhow, Result};
use std::path::{Path, PathBuf};

pub fn canonicalize_existing(path: &Path) -> Result<PathBuf> {
    if !path.exists() {
        return Err(anyhow!("path does not exist: {}", path.display()));
    }
    Ok(path.canonicalize()?)
}

pub fn ensure_within_allowed(path: &Path, allowed_roots: &[PathBuf]) -> Result<PathBuf> {
    if allowed_roots.is_empty() {
        return Err(anyhow!("no allowed roots configured"));
    }

    let normalized_path = canonicalize_existing(path)?;

    for root in allowed_roots {
        if !root.exists() {
            continue;
        }
        let normalized_root = root.canonicalize()?;
        if normalized_path.starts_with(&normalized_root) {
            return Ok(normalized_path);
        }
    }

    Err(anyhow!(
        "path is outside allowed roots: {}",
        normalized_path.display()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn allows_path_inside_root() {
        let temp = tempdir().expect("tempdir");
        let root = temp.path().join("root");
        let nested = root.join("nested");
        fs::create_dir_all(&nested).expect("create nested");
        let file_path = nested.join("SKILL.md");
        fs::write(&file_path, "name: demo").expect("write file");

        let result = ensure_within_allowed(&file_path, &[root]);
        assert!(result.is_ok());
    }

    #[test]
    fn rejects_path_outside_root() {
        let temp = tempdir().expect("tempdir");
        let root = temp.path().join("allowed");
        let outsider = temp.path().join("outside.txt");
        fs::create_dir_all(&root).expect("create root");
        fs::write(&outsider, "outside").expect("write outsider");

        let result = ensure_within_allowed(&outsider, &[root]);
        assert!(result.is_err());
    }
}
