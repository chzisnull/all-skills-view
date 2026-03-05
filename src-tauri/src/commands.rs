use crate::app_state::AppState;
use crate::models::{
    BuildIndexResponse, CommandError, ListSkillTargetsResponse, Platform, PreviewSkillResponse,
    ResolveConflictResponse, ScanResponse, TransferSkillResponse,
};
use crate::path_security;
use crate::services::{
    audit_log,
    conflict_service::{ConflictMode, ConflictService},
    index_service, scan_service, target_service,
    transfer_service::{
        TransferService, ERR_INVALID_ARGUMENT, ERR_IO_FAILURE, ERR_PATH_NOT_FOUND,
        ERR_PERMISSION_DENIED,
    },
};
use std::path::{Path, PathBuf};
use std::str::FromStr;
use tauri::State;

#[tauri::command]
pub fn scan_roots(
    state: State<'_, AppState>,
    roots: Option<Vec<String>>,
) -> Result<ScanResponse, String> {
    let scan_result = scan_service::scan_registry(&state.adapter_registry, roots)
        .map_err(|err| err.to_string())?;
    let (skills, scanned_roots) = scan_result;

    state.merge_allowed_roots(scanned_roots.clone());

    let root_values = scanned_roots
        .iter()
        .map(|p| p.to_string_lossy().to_string())
        .collect::<Vec<_>>();

    let _ = audit_log::write_log(
        &state.db_path,
        "scan_roots",
        "ok",
        &format!("discovered {} skills", skills.len()),
        Some(&format!("roots={}", root_values.len())),
    );

    Ok(ScanResponse {
        skills,
        scanned_roots: root_values,
    })
}

#[tauri::command]
pub fn build_index(
    state: State<'_, AppState>,
    roots: Option<Vec<String>>,
) -> Result<BuildIndexResponse, String> {
    let (skills, scanned_roots) = scan_service::scan_registry(&state.adapter_registry, roots)
        .map_err(|err| err.to_string())?;

    state.merge_allowed_roots(scanned_roots);

    let indexed_count =
        index_service::upsert_skills(&state.db_path, &skills).map_err(|err| err.to_string())?;

    let _ = audit_log::write_log(
        &state.db_path,
        "build_index",
        "ok",
        &format!("indexed {} skills", indexed_count),
        None,
    );

    Ok(BuildIndexResponse { indexed_count })
}

#[tauri::command]
pub fn preview_skill(
    state: State<'_, AppState>,
    skill_id: String,
) -> Result<PreviewSkillResponse, String> {
    let preview =
        index_service::preview_skill(&state.db_path, &skill_id).map_err(|err| err.to_string())?;

    let _ = audit_log::write_log(
        &state.db_path,
        "preview_skill",
        "ok",
        &format!("previewed skill {}", skill_id),
        None,
    );

    Ok(preview)
}

#[tauri::command]
pub fn preview_skill_by_path(
    state: State<'_, AppState>,
    entry_path: Option<String>,
    platform: Option<String>,
    name: Option<String>,
    scope: Option<String>,
    root_path: Option<String>,
) -> Result<PreviewSkillResponse, String> {
    let allowed_roots = state.allowed_roots();

    let normalized_root_path = root_path
        .as_ref()
        .map(|value| {
            path_security::ensure_within_allowed(std::path::Path::new(value), &allowed_roots)
                .map_err(|err| err.to_string())
        })
        .transpose()?;

    let normalized_entry_path = if let Some(value) = entry_path {
        path_security::ensure_within_allowed(std::path::Path::new(&value), &allowed_roots)
            .map_err(|err| err.to_string())?
    } else if let Some(root) = normalized_root_path.as_deref() {
        infer_entry_path_from_root(root).ok_or_else(|| {
            "missing entryPath and cannot infer SKILL.md from rootPath".to_string()
        })?
    } else {
        return Err("missing entryPath".to_string());
    };

    let parsed_platform = platform
        .as_deref()
        .and_then(|value| Platform::from_str(value).ok());

    index_service::preview_skill_by_path(
        &normalized_entry_path,
        parsed_platform,
        name.as_deref(),
        scope.as_deref(),
        normalized_root_path.as_deref(),
    )
    .map_err(|err| err.to_string())
}

fn infer_entry_path_from_root(root: &Path) -> Option<PathBuf> {
    if root.is_file() {
        return Some(root.to_path_buf());
    }

    for candidate in ["SKILL.md", "AGENTS.md", ".cursorrules"] {
        let path = root.join(candidate);
        if path.exists() && path.is_file() {
            return Some(path);
        }
    }

    if let Ok(entries) = std::fs::read_dir(root) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path
                .extension()
                .map(|value| value.to_string_lossy().eq_ignore_ascii_case("mdc"))
                .unwrap_or(false)
            {
                return Some(path);
            }
        }
    }

    None
}

#[tauri::command]
pub fn open_path(state: State<'_, AppState>, path: String) -> Result<String, String> {
    let allowed_roots = state.allowed_roots();
    let normalized =
        path_security::ensure_within_allowed(std::path::Path::new(&path), &allowed_roots)
            .map_err(|err| err.to_string())?;

    let status = std::process::Command::new("open")
        .arg(&normalized)
        .status()
        .map_err(|err| err.to_string())?;

    if !status.success() {
        let _ = audit_log::write_log(
            &state.db_path,
            "open_path",
            "error",
            "open command returned non-zero status",
            Some(&path),
        );
        return Err("failed to open target path".to_string());
    }

    let _ = audit_log::write_log(
        &state.db_path,
        "open_path",
        "ok",
        "opened path",
        Some(&normalized.to_string_lossy()),
    );

    Ok(normalized.to_string_lossy().to_string())
}

#[tauri::command]
pub fn list_logs(
    state: State<'_, AppState>,
    limit: Option<usize>,
) -> Result<Vec<crate::models::OperationLogRecord>, String> {
    let value = limit.unwrap_or(50).min(500);
    audit_log::list_logs(&state.db_path, value).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn list_skill_targets(
    state: State<'_, AppState>,
) -> Result<ListSkillTargetsResponse, CommandError> {
    let targets = target_service::list_copy_targets();
    let roots = targets
        .iter()
        .map(|item| PathBuf::from(&item.path))
        .collect::<Vec<_>>();
    state.merge_allowed_roots(roots);

    Ok(ListSkillTargetsResponse { targets })
}

#[tauri::command]
pub fn import_skill(
    state: State<'_, AppState>,
    source_path: String,
    target_path: Option<String>,
    tool: Option<String>,
    scope: Option<String>,
    // legacy fields, kept for compatibility
    target_root: Option<String>,
    target_tool: Option<String>,
    target_scope: Option<String>,
    conflict_mode: Option<String>,
    rename_to: Option<String>,
) -> Result<TransferSkillResponse, CommandError> {
    if conflict_mode.is_some() || rename_to.is_some() {
        return Err(command_error(
            ERR_INVALID_ARGUMENT,
            "import_skill 不支持 conflict_mode/rename_to，目标同名时固定拒绝复制",
            None,
        ));
    }

    let allowed_roots = state.allowed_roots();
    let normalized_source = ensure_allowed(&source_path, &allowed_roots)?;
    let normalized_target_root = resolve_target_root(
        &state,
        target_path,
        tool,
        scope,
        target_root,
        target_tool,
        target_scope,
    )?;

    let outcome = TransferService::import_skill(&normalized_source, &normalized_target_root)
        .map_err(transfer_error_to_command_error)?;

    let final_path = outcome.final_path.to_string_lossy().to_string();
    let _ = audit_log::write_log(
        &state.db_path,
        "import_skill",
        "ok",
        "import completed",
        Some(&final_path),
    );

    Ok(TransferSkillResponse {
        operation: "import_skill".to_string(),
        status: "ok".to_string(),
        final_path,
        conflict_mode: outcome
            .conflict_mode
            .map(|value| value.as_str().to_string()),
    })
}

#[tauri::command]
pub fn export_skill(
    state: State<'_, AppState>,
    entry_path: String,
    target_dir: String,
    conflict_mode: Option<String>,
    rename_to: Option<String>,
) -> Result<TransferSkillResponse, CommandError> {
    let allowed_roots = state.allowed_roots();
    let normalized_entry = ensure_allowed(&entry_path, &allowed_roots)?;
    let normalized_target_dir = ensure_allowed(&target_dir, &allowed_roots)?;
    let parsed_mode = parse_conflict_mode(conflict_mode)?;

    let outcome = TransferService::export_skill(
        &normalized_entry,
        &normalized_target_dir,
        parsed_mode,
        rename_to.as_deref(),
    )
    .map_err(transfer_error_to_command_error)?;

    let final_path = outcome.final_path.to_string_lossy().to_string();
    let _ = audit_log::write_log(
        &state.db_path,
        "export_skill",
        "ok",
        "export completed",
        Some(&final_path),
    );

    Ok(TransferSkillResponse {
        operation: "export_skill".to_string(),
        status: "ok".to_string(),
        final_path,
        conflict_mode: outcome
            .conflict_mode
            .map(|value| value.as_str().to_string()),
    })
}

#[tauri::command]
pub fn resolve_conflict(
    state: State<'_, AppState>,
    source_path: String,
    existing_path: String,
    mode: String,
    rename_to: Option<String>,
) -> Result<ResolveConflictResponse, CommandError> {
    let allowed_roots = state.allowed_roots();
    let normalized_source = ensure_allowed(&source_path, &allowed_roots)?;
    let normalized_existing = ensure_allowed(&existing_path, &allowed_roots)?;
    let conflict_mode = parse_conflict_mode(Some(mode))?
        .ok_or_else(|| command_error(ERR_INVALID_ARGUMENT, "missing conflict mode", None))?;

    let final_path = ConflictService::resolve(
        &normalized_source,
        &normalized_existing,
        conflict_mode,
        rename_to.as_deref(),
    )
    .map_err(|err| {
        command_error(
            classify_path_error_code(&err.to_string()),
            err.to_string(),
            Some(existing_path.clone()),
        )
    })?;

    let final_path_text = final_path.to_string_lossy().to_string();
    let _ = audit_log::write_log(
        &state.db_path,
        "resolve_conflict",
        "ok",
        &format!("resolved by {}", conflict_mode.as_str()),
        Some(&final_path_text),
    );

    Ok(ResolveConflictResponse {
        status: "ok".to_string(),
        mode: conflict_mode.as_str().to_string(),
        final_path: final_path_text,
    })
}

fn ensure_allowed(
    path: &str,
    allowed_roots: &[std::path::PathBuf],
) -> Result<std::path::PathBuf, CommandError> {
    path_security::ensure_within_allowed(Path::new(path), allowed_roots).map_err(|err| {
        command_error(
            classify_path_error_code(&err.to_string()),
            err.to_string(),
            Some(path.to_string()),
        )
    })
}

fn resolve_target_root(
    state: &State<'_, AppState>,
    target_path: Option<String>,
    tool: Option<String>,
    scope: Option<String>,
    target_root: Option<String>,
    target_tool: Option<String>,
    target_scope: Option<String>,
) -> Result<PathBuf, CommandError> {
    let canonical_target_path = target_path.or(target_root);
    let canonical_tool = tool.or(target_tool);
    let canonical_scope = scope.or(target_scope);

    if canonical_target_path.is_some() && canonical_tool.is_some() {
        return Err(command_error(
            ERR_INVALID_ARGUMENT,
            "target_path and tool are mutually exclusive",
            None,
        ));
    }

    if canonical_tool.is_none() && canonical_scope.is_some() {
        return Err(command_error(
            ERR_INVALID_ARGUMENT,
            "scope requires tool",
            None,
        ));
    }

    if let Some(raw_target_path) = canonical_target_path {
        let allowed_roots = state.allowed_roots();
        return ensure_allowed(&raw_target_path, &allowed_roots);
    }

    if let Some(tool_name) = canonical_tool {
        let scope_name = canonical_scope.unwrap_or_else(|| "global".to_string());
        let resolved =
            target_service::resolve_copy_target(&tool_name, &scope_name).ok_or_else(|| {
                command_error(
                    ERR_INVALID_ARGUMENT,
                    "unsupported target tool/scope",
                    Some(format!("tool={tool_name},scope={scope_name}")),
                )
            })?;

        std::fs::create_dir_all(&resolved).map_err(|err| {
            command_error(
                classify_path_error_code(&err.to_string()),
                err.to_string(),
                Some(resolved.to_string_lossy().to_string()),
            )
        })?;

        state.merge_allowed_roots(vec![resolved.clone()]);
        let allowed_roots = state.allowed_roots();
        return ensure_allowed(&resolved.to_string_lossy(), &allowed_roots);
    }

    Err(command_error(
        ERR_INVALID_ARGUMENT,
        "either target_path or tool/scope must be provided",
        None,
    ))
}

fn parse_conflict_mode(mode: Option<String>) -> Result<Option<ConflictMode>, CommandError> {
    match mode {
        Some(value) => ConflictMode::from_input(&value).map(Some).ok_or_else(|| {
            command_error(
                ERR_INVALID_ARGUMENT,
                "invalid conflict mode, expected skip|rename|overwrite|side_by_side",
                Some(value),
            )
        }),
        None => Ok(None),
    }
}

fn transfer_error_to_command_error(
    error: crate::services::transfer_service::TransferError,
) -> CommandError {
    command_error(error.code, error.message, error.details)
}

fn command_error(
    code: impl Into<String>,
    message: impl Into<String>,
    details: Option<String>,
) -> CommandError {
    CommandError::new(code, message, details)
}

fn classify_path_error_code(message: &str) -> &'static str {
    let lower = message.to_lowercase();
    if lower.contains("outside allowed roots")
        || lower.contains("no allowed roots configured")
        || lower.contains("permission denied")
    {
        return ERR_PERMISSION_DENIED;
    }
    if lower.contains("does not exist") || lower.contains("not found") {
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
    fn classify_path_error_maps_permission_and_missing() {
        assert_eq!(
            classify_path_error_code("path is outside allowed roots: /tmp/x"),
            ERR_PERMISSION_DENIED
        );
        assert_eq!(
            classify_path_error_code("path does not exist: /tmp/x"),
            ERR_PATH_NOT_FOUND
        );
    }

    #[test]
    fn ensure_allowed_returns_permission_denied_for_outside_root() {
        let temp = tempdir().expect("tempdir");
        let allowed = temp.path().join("allowed");
        fs::create_dir_all(&allowed).expect("create allowed");

        let outsider = temp.path().join("outsider.txt");
        fs::write(&outsider, "data").expect("write outsider");

        let result = ensure_allowed(
            outsider.to_string_lossy().as_ref(),
            std::slice::from_ref(&allowed),
        );
        let error = result.expect_err("outside root should be rejected");
        assert_eq!(error.code, ERR_PERMISSION_DENIED);
    }
}
