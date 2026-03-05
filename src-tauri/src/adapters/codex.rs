use super::{build_canonical, dedupe_paths, home, read_description, SkillAdapter};
use crate::models::{CanonicalSkill, Platform, RawSkill};
use anyhow::Result;
use std::path::PathBuf;
use walkdir::WalkDir;

pub struct CodexAdapter;

impl SkillAdapter for CodexAdapter {
    fn platform(&self) -> Platform {
        Platform::Codex
    }

    fn default_roots(&self) -> Vec<PathBuf> {
        let mut roots = vec![PathBuf::from("/etc/codex/skills")];
        if let Some(home_dir) = home() {
            roots.push(home_dir.join(".codex").join("skills"));
        }
        dedupe_paths(roots)
    }

    fn discover(&self, roots: &[PathBuf]) -> Result<Vec<RawSkill>> {
        let mut found = Vec::new();

        for root in roots {
            if !root.exists() {
                continue;
            }

            for entry in WalkDir::new(root)
                .max_depth(6)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if !entry.file_type().is_file() {
                    continue;
                }
                if entry.file_name().to_string_lossy() != "SKILL.md" {
                    continue;
                }

                let entry_path = entry.path().to_path_buf();
                let name = entry_path
                    .parent()
                    .and_then(|p| p.file_name())
                    .map(|n| n.to_string_lossy().to_string())
                    .unwrap_or_else(|| "unnamed-codex-skill".to_string());

                let root_text = root.to_string_lossy();
                let scope = if root_text.starts_with("/etc") {
                    "system"
                } else {
                    "global"
                }
                .to_string();

                found.push(RawSkill {
                    platform: Platform::Codex,
                    name,
                    scope,
                    root_path: root.to_string_lossy().to_string(),
                    entry_path: entry_path.to_string_lossy().to_string(),
                    description: read_description(&entry_path),
                });
            }
        }

        Ok(found)
    }

    fn normalize(&self, raw: RawSkill) -> Result<CanonicalSkill> {
        build_canonical(raw)
    }
}
