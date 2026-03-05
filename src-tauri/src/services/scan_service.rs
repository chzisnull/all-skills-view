use crate::adapters::AdapterRegistry;
use crate::models::CanonicalSkill;
use anyhow::Result;
use std::collections::HashSet;
use std::path::PathBuf;

pub fn scan_registry(
    adapter_registry: &AdapterRegistry,
    requested_roots: Option<Vec<String>>,
) -> Result<(Vec<CanonicalSkill>, Vec<PathBuf>)> {
    let custom_roots =
        requested_roots.map(|items| items.into_iter().map(PathBuf::from).collect::<Vec<_>>());

    let mut aggregated = Vec::new();
    let mut used_roots = Vec::new();

    for adapter in adapter_registry.adapters() {
        let roots = custom_roots
            .clone()
            .unwrap_or_else(|| adapter.default_roots());

        used_roots.extend(roots.clone());

        let raw_skills = adapter.discover(&roots)?;
        for raw in raw_skills {
            aggregated.push(adapter.normalize(raw)?);
        }
    }

    let mut seen = HashSet::new();
    aggregated.retain(|item| seen.insert(item.id.clone()));

    let mut seen_roots = HashSet::new();
    used_roots.retain(|root| seen_roots.insert(root.to_string_lossy().to_string()));

    Ok((aggregated, used_roots))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adapters::AdapterRegistry;
    use crate::db;
    use crate::services::{
        audit_log,
        conflict_service::{ConflictMode, ConflictService},
        index_service,
        transfer_service::{TransferService, ERR_CONFLICT_DETECTED},
    };
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn scan_index_preview_chain_smoke() {
        let temp = tempdir().expect("tempdir");
        let skill_dir = temp.path().join("demo-skill");
        fs::create_dir_all(&skill_dir).expect("create demo skill dir");
        fs::write(
            skill_dir.join("SKILL.md"),
            "---\nname: demo-skill\n---\nThis is a smoke test skill.\n",
        )
        .expect("write SKILL.md");

        let registry = AdapterRegistry::new();
        let root = temp.path().to_string_lossy().to_string();
        let (skills, _) = scan_registry(&registry, Some(vec![root])).expect("scan should succeed");
        assert!(
            !skills.is_empty(),
            "at least one skill should be discovered"
        );

        let db_path = temp.path().join("test.db");
        db::init(&db_path).expect("init db");
        let indexed = index_service::upsert_skills(&db_path, &skills).expect("index skills");
        assert!(indexed > 0, "index count should be positive");

        let preview = index_service::preview_skill(&db_path, &skills[0].id).expect("preview skill");
        assert!(
            preview.content.contains("smoke test skill"),
            "preview should return stored skill content"
        );
    }

    #[test]
    fn full_flow_scan_to_logs_smoke() {
        let temp = tempdir().expect("tempdir");
        let source_root = temp.path().join("source");
        let import_root = temp.path().join("import-target");
        let export_root = temp.path().join("export-target");
        fs::create_dir_all(&source_root).expect("create source root");
        fs::create_dir_all(&import_root).expect("create import root");
        fs::create_dir_all(&export_root).expect("create export root");

        let skill_dir = source_root.join("flow-skill");
        fs::create_dir_all(&skill_dir).expect("create skill dir");
        let skill_file = skill_dir.join("SKILL.md");
        fs::write(
            &skill_file,
            "---\nname: flow-skill\n---\nscan->index->preview->import/export/conflict/logs\n",
        )
        .expect("write skill file");

        let db_path = temp.path().join("flow.db");
        db::init(&db_path).expect("init db");

        let registry = AdapterRegistry::new();
        let root = source_root.to_string_lossy().to_string();
        let (skills, _) = scan_registry(&registry, Some(vec![root])).expect("scan should succeed");
        assert!(!skills.is_empty(), "scan should find at least one skill");
        audit_log::write_log(&db_path, "scan_roots", "ok", "scan done", None).expect("log scan");

        let indexed =
            index_service::upsert_skills(&db_path, &skills).expect("index should succeed");
        assert!(indexed > 0, "index count should be positive");
        audit_log::write_log(&db_path, "build_index", "ok", "index done", None).expect("log index");

        let preview =
            index_service::preview_skill(&db_path, &skills[0].id).expect("preview should succeed");
        assert!(
            preview.content.contains("scan->index->preview"),
            "preview content should match"
        );
        audit_log::write_log(&db_path, "preview_skill", "ok", "preview done", None)
            .expect("log preview");

        let import_outcome =
            TransferService::import_skill(&skill_file, &import_root).expect("import");
        assert!(
            import_outcome.final_path.exists(),
            "imported file should exist"
        );
        audit_log::write_log(&db_path, "import_skill", "ok", "import done", None)
            .expect("log import");

        let export_outcome = TransferService::export_skill(
            &skill_file,
            &export_root,
            Some(ConflictMode::Rename),
            Some("SKILL-exported.md"),
        )
        .expect("export");
        assert!(
            export_outcome.final_path.exists(),
            "exported file should exist"
        );
        audit_log::write_log(&db_path, "export_skill", "ok", "export done", None)
            .expect("log export");

        let existing = import_root.join("SKILL.md");
        let resolved =
            ConflictService::resolve(&skill_file, &existing, ConflictMode::SideBySide, None)
                .expect("resolve conflict");
        assert!(resolved.exists(), "resolved side-by-side path should exist");
        assert_ne!(
            resolved, existing,
            "side-by-side should not overwrite existing"
        );
        audit_log::write_log(
            &db_path,
            "resolve_conflict",
            "ok",
            "conflict resolved",
            None,
        )
        .expect("log conflict");

        let logs = audit_log::list_logs(&db_path, 20).expect("list logs");
        let operations = logs
            .iter()
            .map(|log| log.operation_type.clone())
            .collect::<Vec<_>>();

        for expected in [
            "scan_roots",
            "build_index",
            "preview_skill",
            "import_skill",
            "export_skill",
            "resolve_conflict",
        ] {
            assert!(
                operations.iter().any(|item| item == expected),
                "missing log operation: {expected}"
            );
        }
    }

    #[test]
    fn full_flow_codex_global_import_conflict_resolve_logs_smoke() {
        let temp = tempdir().expect("tempdir");
        let source_root = temp.path().join("source");
        let codex_global_root = temp.path().join("home").join(".agents").join("skills");
        fs::create_dir_all(&source_root).expect("create source root");
        fs::create_dir_all(&codex_global_root).expect("create codex global root");

        let skill_dir = source_root.join("codex-global-flow");
        fs::create_dir_all(&skill_dir).expect("create skill dir");
        let skill_file = skill_dir.join("SKILL.md");
        fs::write(
            &skill_file,
            "---\nname: codex-global-flow\n---\nscan->preview->import-codex-global->conflict->resolve->logs\n",
        )
        .expect("write skill file");

        let db_path = temp.path().join("codex-global-flow.db");
        db::init(&db_path).expect("init db");

        let registry = AdapterRegistry::new();
        let root = source_root.to_string_lossy().to_string();
        let (skills, _) = scan_registry(&registry, Some(vec![root])).expect("scan should succeed");
        assert!(!skills.is_empty(), "scan should discover skill");
        audit_log::write_log(&db_path, "scan_roots", "ok", "scan done", None).expect("log scan");

        let indexed =
            index_service::upsert_skills(&db_path, &skills).expect("index should succeed");
        assert!(indexed > 0, "index count should be positive");
        audit_log::write_log(&db_path, "build_index", "ok", "index done", None).expect("log index");

        let preview =
            index_service::preview_skill(&db_path, &skills[0].id).expect("preview should succeed");
        assert!(
            preview.content.contains("import-codex-global"),
            "preview should contain codex global flow content"
        );
        audit_log::write_log(&db_path, "preview_skill", "ok", "preview done", None)
            .expect("log preview");

        let first_import = TransferService::import_skill(&skill_file, &codex_global_root)
            .expect("first import should succeed");
        assert!(
            first_import.final_path.exists(),
            "imported file should exist"
        );
        assert!(
            first_import
                .final_path
                .to_string_lossy()
                .contains(".agents/skills"),
            "target should be codex global shaped path"
        );
        audit_log::write_log(&db_path, "import_skill", "ok", "import done", None)
            .expect("log import");

        let second_import = TransferService::import_skill(&skill_file, &codex_global_root)
            .expect_err("second import should conflict");
        assert_eq!(second_import.code, ERR_CONFLICT_DETECTED);
        audit_log::write_log(
            &db_path,
            "import_skill",
            "error",
            "conflict detected",
            Some(second_import.details.as_deref().unwrap_or("")),
        )
        .expect("log import conflict");

        let existing = codex_global_root.join("SKILL.md");
        let resolved = ConflictService::resolve(&skill_file, &existing, ConflictMode::Rename, None)
            .expect("resolve conflict");
        assert!(resolved.exists(), "resolved path should exist");
        audit_log::write_log(
            &db_path,
            "resolve_conflict",
            "ok",
            "resolved conflict",
            Some(&resolved.to_string_lossy()),
        )
        .expect("log resolve");

        let logs = audit_log::list_logs(&db_path, 50).expect("list logs");
        let operations = logs
            .iter()
            .map(|log| log.operation_type.clone())
            .collect::<Vec<_>>();
        for expected in [
            "scan_roots",
            "build_index",
            "preview_skill",
            "import_skill",
            "resolve_conflict",
        ] {
            assert!(
                operations.iter().any(|item| item == expected),
                "missing operation {expected}"
            );
        }
    }
}
