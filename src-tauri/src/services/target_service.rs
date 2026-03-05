use crate::adapters::home;
use crate::models::SkillCopyTarget;
use std::path::{Path, PathBuf};

const GLOBAL_SCOPE: &str = "global";

#[derive(Debug, Clone)]
pub struct TargetDescriptor {
    pub tool: &'static str,
    pub scope: &'static str,
    pub path: PathBuf,
}

pub fn list_copy_targets() -> Vec<SkillCopyTarget> {
    build_targets(home())
        .into_iter()
        .map(|item| SkillCopyTarget {
            tool: item.tool.to_string(),
            scope: item.scope.to_string(),
            target_path: item.path.to_string_lossy().to_string(),
            path: item.path.to_string_lossy().to_string(),
            exists: item.path.exists(),
        })
        .collect()
}

pub fn resolve_copy_target(tool: &str, scope: &str) -> Option<PathBuf> {
    let normalized_tool = normalize_tool(tool.trim());
    let normalized_scope = scope.trim().to_lowercase();
    build_targets(home()).into_iter().find_map(|item| {
        if item.tool == normalized_tool && item.scope == normalized_scope {
            Some(item.path)
        } else {
            None
        }
    })
}

fn normalize_tool(tool: &str) -> String {
    match tool.to_lowercase().as_str() {
        "claude" | "claudecode" | "claudcode" => "claudcode".to_string(),
        other => other.to_string(),
    }
}

fn build_targets(home_dir: Option<PathBuf>) -> Vec<TargetDescriptor> {
    let mut targets = Vec::new();
    if let Some(home_path) = home_dir.as_ref() {
        for tool in ["codex", "opencode", "openclaw", "claudcode"] {
            targets.push(TargetDescriptor {
                tool,
                scope: GLOBAL_SCOPE,
                path: global_path_for(tool, home_path),
            });
        }
    }
    targets
}

fn global_path_for(tool: &str, home_dir: &Path) -> PathBuf {
    match tool {
        "codex" => home_dir.join(".codex").join("skills"),
        "opencode" => home_dir.join(".opencode").join("skills"),
        "openclaw" => home_dir.join(".openclaw").join("workspace").join("skills"),
        "claudcode" => home_dir.join(".claude").join("skills"),
        _ => home_dir.join(".unknown").join("skills"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::transfer_service::{TransferService, ERR_CONFLICT_DETECTED};
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn includes_required_global_targets() {
        let home = tempdir().expect("home tempdir");
        let targets = build_targets(Some(home.path().to_path_buf()));

        let has_codex = targets.iter().any(|t| {
            t.tool == "codex" && t.scope == GLOBAL_SCOPE && t.path.ends_with(".codex/skills")
        });
        let has_opencode = targets.iter().any(|t| {
            t.tool == "opencode" && t.scope == GLOBAL_SCOPE && t.path.ends_with(".opencode/skills")
        });
        let has_openclaw = targets.iter().any(|t| {
            t.tool == "openclaw"
                && t.scope == GLOBAL_SCOPE
                && t.path.ends_with(".openclaw/workspace/skills")
        });
        let has_claudcode = targets.iter().any(|t| {
            t.tool == "claudcode" && t.scope == GLOBAL_SCOPE && t.path.ends_with(".claude/skills")
        });

        assert!(has_codex, "missing codex global target");
        assert!(has_opencode, "missing opencode global target");
        assert!(has_openclaw, "missing openclaw global target");
        assert!(has_claudcode, "missing claudcode global target");
    }

    #[test]
    fn contains_only_global_scope_for_each_tool() {
        let home = tempdir().expect("home tempdir");
        let targets = build_targets(Some(home.path().to_path_buf()));

        for tool in ["codex", "opencode", "openclaw", "claudcode"] {
            assert!(
                targets
                    .iter()
                    .any(|t| t.tool == tool && t.scope == GLOBAL_SCOPE),
                "missing global scope for {tool}"
            );
            assert!(
                !targets
                    .iter()
                    .any(|t| t.tool == tool && t.scope != GLOBAL_SCOPE),
                "unexpected non-global scope for {tool}"
            );
        }
    }

    #[test]
    fn supports_tool_scope_selection_for_import_and_conflict() {
        let home = tempdir().expect("home tempdir");
        let source = tempdir().expect("source tempdir");

        let source_file = source.path().join("SKILL.md");
        fs::write(&source_file, "skill content").expect("write source skill");

        let targets = build_targets(Some(home.path().to_path_buf()));
        let codex_global = targets
            .iter()
            .find(|item| item.tool == "codex" && item.scope == GLOBAL_SCOPE)
            .expect("codex global target")
            .path
            .clone();

        fs::create_dir_all(&codex_global).expect("create codex global dir");
        let imported =
            TransferService::import_skill(&source_file, &codex_global).expect("first import");
        assert!(imported.final_path.exists(), "imported file should exist");

        let second = TransferService::import_skill(&source_file, &codex_global);
        let error = second.expect_err("second import should conflict");
        assert_eq!(error.code, ERR_CONFLICT_DETECTED);
    }

    #[test]
    fn resolve_target_supports_claude_alias() {
        let path = resolve_copy_target("claude", "global");
        assert!(
            path.is_some(),
            "claude alias should resolve to claudcode target"
        );
    }
}
