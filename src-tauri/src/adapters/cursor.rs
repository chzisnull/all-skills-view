use super::{build_canonical, current_dir, dedupe_paths, home, read_description, SkillAdapter};
use crate::models::{CanonicalSkill, Platform, RawSkill};
use anyhow::Result;
use std::path::PathBuf;
use walkdir::WalkDir;

pub struct CursorAdapter;

impl SkillAdapter for CursorAdapter {
    fn platform(&self) -> Platform {
        Platform::Cursor
    }

    fn default_roots(&self) -> Vec<PathBuf> {
        let cwd = current_dir();
        let mut roots = vec![cwd.clone(), cwd.join(".cursor").join("rules")];
        if let Some(home_dir) = home() {
            roots.push(home_dir.join(".cursor").join("rules"));
        }
        dedupe_paths(roots)
    }

    fn discover(&self, roots: &[PathBuf]) -> Result<Vec<RawSkill>> {
        let project_root = current_dir();
        let mut found = Vec::new();

        for root in roots {
            if !root.exists() {
                continue;
            }

            for entry in WalkDir::new(root)
                .max_depth(4)
                .follow_links(false)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if !entry.file_type().is_file() {
                    continue;
                }

                let file_name = entry.file_name().to_string_lossy().to_string();
                let path = entry.path();
                let is_cursor_rule = path
                    .components()
                    .any(|component| component.as_os_str().to_string_lossy() == ".cursor")
                    && path.extension().map(|ext| ext == "mdc").unwrap_or(false);

                let is_agents = file_name == "AGENTS.md";
                let is_legacy_rules = file_name == ".cursorrules";

                if !(is_cursor_rule || is_agents || is_legacy_rules) {
                    continue;
                }

                let entry_path = path.to_path_buf();
                let name = if is_agents {
                    "agents".to_string()
                } else if is_legacy_rules {
                    "legacy-rules".to_string()
                } else {
                    entry_path
                        .file_stem()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_else(|| "cursor-rule".to_string())
                };

                let scope = if entry_path.starts_with(&project_root) {
                    "project"
                } else {
                    "user"
                }
                .to_string();

                found.push(RawSkill {
                    platform: Platform::Cursor,
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
