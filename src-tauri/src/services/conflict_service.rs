use anyhow::{anyhow, Result};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConflictMode {
    Skip,
    Rename,
    Overwrite,
    SideBySide,
}

impl ConflictMode {
    pub fn from_input(value: &str) -> Option<Self> {
        match value.to_lowercase().as_str() {
            "skip" => Some(Self::Skip),
            "rename" => Some(Self::Rename),
            "overwrite" => Some(Self::Overwrite),
            "sidebyside" | "side_by_side" => Some(Self::SideBySide),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Skip => "skip",
            Self::Rename => "rename",
            Self::Overwrite => "overwrite",
            Self::SideBySide => "side_by_side",
        }
    }
}

pub struct ConflictService;

impl ConflictService {
    pub fn resolve(
        source_path: &Path,
        existing_path: &Path,
        mode: ConflictMode,
        rename_to: Option<&str>,
    ) -> Result<PathBuf> {
        match mode {
            ConflictMode::Skip => Ok(existing_path.to_path_buf()),
            ConflictMode::Overwrite => {
                if existing_path.exists() {
                    remove_path(existing_path)?;
                }
                copy_path(source_path, existing_path)?;
                Ok(existing_path.to_path_buf())
            }
            ConflictMode::Rename => {
                let renamed = rename_candidate(existing_path, source_path, rename_to, "-imported")?;
                copy_path(source_path, &renamed)?;
                Ok(renamed)
            }
            ConflictMode::SideBySide => {
                let sibling = rename_candidate(existing_path, source_path, None, "-side-by-side")?;
                copy_path(source_path, &sibling)?;
                Ok(sibling)
            }
        }
    }
}

pub fn copy_path(source_path: &Path, target_path: &Path) -> Result<()> {
    if !source_path.exists() {
        return Err(anyhow!(
            "source path does not exist: {}",
            source_path.display()
        ));
    }

    if source_path.is_file() {
        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::copy(source_path, target_path)?;
        return Ok(());
    }

    if source_path.is_dir() {
        copy_dir_recursive(source_path, target_path)?;
        return Ok(());
    }

    Err(anyhow!(
        "unsupported source type: {}",
        source_path.display()
    ))
}

fn copy_dir_recursive(source_dir: &Path, target_dir: &Path) -> Result<()> {
    fs::create_dir_all(target_dir)?;
    for entry in fs::read_dir(source_dir)? {
        let entry = entry?;
        let source_child = entry.path();
        let target_child = target_dir.join(entry.file_name());
        if source_child.is_dir() {
            copy_dir_recursive(&source_child, &target_child)?;
        } else {
            if let Some(parent) = target_child.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(&source_child, &target_child)?;
        }
    }
    Ok(())
}

fn remove_path(path: &Path) -> Result<()> {
    if path.is_dir() {
        fs::remove_dir_all(path)?;
    } else if path.exists() {
        fs::remove_file(path)?;
    }
    Ok(())
}

fn rename_candidate(
    existing_path: &Path,
    source_path: &Path,
    rename_to: Option<&str>,
    suffix: &str,
) -> Result<PathBuf> {
    let parent = existing_path
        .parent()
        .ok_or_else(|| anyhow!("target has no parent: {}", existing_path.display()))?;

    let preferred_name = rename_to
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .unwrap_or_else(|| default_name(source_path, suffix));

    let preferred = parent.join(preferred_name);
    Ok(unique_path(preferred))
}

fn default_name(path: &Path, suffix: &str) -> String {
    let stem = path
        .file_stem()
        .map(|v| v.to_string_lossy().to_string())
        .unwrap_or_else(|| "skill".to_string());
    match path.extension().map(|v| v.to_string_lossy().to_string()) {
        Some(ext) if !ext.is_empty() => format!("{stem}{suffix}.{ext}"),
        _ => format!("{stem}{suffix}"),
    }
}

fn unique_path(mut candidate: PathBuf) -> PathBuf {
    if !candidate.exists() {
        return candidate;
    }

    let parent = candidate
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from("."));
    let stem = candidate
        .file_stem()
        .map(|v| v.to_string_lossy().to_string())
        .unwrap_or_else(|| "skill".to_string());
    let ext = candidate
        .extension()
        .map(|v| v.to_string_lossy().to_string());

    let mut index = 2;
    loop {
        let file_name = match &ext {
            Some(ext_value) if !ext_value.is_empty() => format!("{stem}-{index}.{ext_value}"),
            _ => format!("{stem}-{index}"),
        };
        candidate = parent.join(file_name);
        if !candidate.exists() {
            return candidate;
        }
        index += 1;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn from_input_supports_aliases() {
        assert_eq!(ConflictMode::from_input("skip"), Some(ConflictMode::Skip));
        assert_eq!(
            ConflictMode::from_input("side_by_side"),
            Some(ConflictMode::SideBySide)
        );
        assert_eq!(
            ConflictMode::from_input("sidebyside"),
            Some(ConflictMode::SideBySide)
        );
        assert_eq!(ConflictMode::from_input("unknown"), None);
    }

    #[test]
    fn resolve_rename_creates_new_file() {
        let temp = tempdir().expect("tempdir");
        let source = temp.path().join("source.md");
        let existing = temp.path().join("skill.md");
        fs::write(&source, "incoming").expect("write source");
        fs::write(&existing, "existing").expect("write existing");

        let resolved = ConflictService::resolve(&source, &existing, ConflictMode::Rename, None)
            .expect("resolve rename");

        assert!(resolved.exists());
        assert_ne!(resolved, existing);
        assert_eq!(
            fs::read_to_string(&resolved).expect("read resolved"),
            "incoming"
        );
        assert_eq!(
            fs::read_to_string(&existing).expect("read existing"),
            "existing"
        );
    }
}
