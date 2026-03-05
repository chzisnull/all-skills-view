#[cfg(test)]
mod tests {
    use crate::adapters::AdapterRegistry;
    use crate::app_state::AppState;
    use crate::db;
    use crate::services::{
        audit_log,
        conflict_service::{ConflictMode, ConflictService},
        index_service, scan_service,
        transfer_service::TransferService,
    };
    use std::fs;
    use std::time::Instant;
    use tempfile::tempdir;

    const SCAN_FILE_SAMPLE: usize = 2_500;
    const BATCH_IMPORT_COUNT: usize = 500;
    const INCREMENTAL_TOUCH_COUNT: usize = 25;

    #[test]
    fn nfr_baseline_metrics() {
        let temp = tempdir().expect("tempdir");
        let source_root = temp.path().join("nfr-source");
        fs::create_dir_all(&source_root).expect("create source root");

        for idx in 0..SCAN_FILE_SAMPLE {
            let skill_dir = source_root.join(format!("skill-{idx:05}"));
            fs::create_dir_all(&skill_dir).expect("create skill dir");
            fs::write(
                skill_dir.join("SKILL.md"),
                format!("---\nname: nfr-{idx:05}\n---\nNFR benchmark entry.\n"),
            )
            .expect("write skill");
        }

        let db_path = temp.path().join("nfr.db");
        let startup_begin = Instant::now();
        db::init(&db_path).expect("init db");
        let registry = AdapterRegistry::new();
        let allowed_roots = registry.default_roots();
        let _state = AppState::new(db_path.clone(), registry.clone(), allowed_roots);
        let cold_start_ms = startup_begin.elapsed().as_secs_f64() * 1000.0;

        let scan_begin = Instant::now();
        let (skills_first, _) = scan_service::scan_registry(
            &registry,
            Some(vec![source_root.to_string_lossy().to_string()]),
        )
        .expect("first scan");
        let first_scan_ms = scan_begin.elapsed().as_secs_f64() * 1000.0;
        let discovered_count = skills_first.len();

        let index_begin = Instant::now();
        index_service::upsert_skills(&db_path, &skills_first).expect("first index");
        let first_index_ms = index_begin.elapsed().as_secs_f64() * 1000.0;

        for idx in 0..INCREMENTAL_TOUCH_COUNT {
            let skill_file = source_root.join(format!("skill-{idx:05}")).join("SKILL.md");
            fs::write(
                skill_file,
                format!("---\nname: nfr-{idx:05}\n---\nNFR benchmark changed.\n"),
            )
            .expect("touch skill");
        }

        let incremental_begin = Instant::now();
        let (skills_incremental, _) = scan_service::scan_registry(
            &registry,
            Some(vec![source_root.to_string_lossy().to_string()]),
        )
        .expect("incremental scan");
        index_service::upsert_skills(&db_path, &skills_incremental).expect("incremental index");
        let incremental_refresh_ms = incremental_begin.elapsed().as_secs_f64() * 1000.0;

        let import_source_root = temp.path().join("import-source");
        let import_target_root = temp.path().join("import-target");
        fs::create_dir_all(&import_source_root).expect("create import source");
        fs::create_dir_all(&import_target_root).expect("create import target");

        for idx in 0..BATCH_IMPORT_COUNT {
            fs::write(
                import_source_root.join(format!("batch-{idx:05}.md")),
                format!("batch-import-{idx}"),
            )
            .expect("write import sample");
        }

        let import_begin = Instant::now();
        for idx in 0..BATCH_IMPORT_COUNT {
            let source_path = import_source_root.join(format!("batch-{idx:05}.md"));
            TransferService::import_skill(&source_path, &import_target_root)
                .expect("batch import item");
        }
        let import_secs = import_begin.elapsed().as_secs_f64();
        let import_throughput = if import_secs > 0.0 {
            BATCH_IMPORT_COUNT as f64 / import_secs
        } else {
            f64::INFINITY
        };

        let conflict_source = import_source_root.join("batch-00000.md");
        let conflict_existing = import_target_root.join("batch-00000.md");
        let conflict_final = ConflictService::resolve(
            &conflict_source,
            &conflict_existing,
            ConflictMode::SideBySide,
            None,
        )
        .expect("resolve conflict");

        for op in [
            "scan_roots",
            "build_index",
            "preview_skill",
            "import_skill",
            "export_skill",
            "resolve_conflict",
        ] {
            audit_log::write_log(&db_path, op, "ok", "nfr benchmark", None).expect("write log");
        }

        let logs = audit_log::list_logs(&db_path, 20).expect("list logs");

        let first_scan_10k_equiv_ms = if discovered_count > 0 {
            first_scan_ms * (10_000.0 / discovered_count as f64)
        } else {
            0.0
        };

        println!(
            "NFR_METRICS cold_start_ms={:.2} first_scan_ms={:.2} first_scan_entries={} first_scan_10k_equiv_ms={:.2} first_index_ms={:.2} incremental_refresh_ms={:.2} batch_import_throughput_per_sec={:.2} conflict_final_path={} logs_count={}",
            cold_start_ms,
            first_scan_ms,
            discovered_count,
            first_scan_10k_equiv_ms,
            first_index_ms,
            incremental_refresh_ms,
            import_throughput,
            conflict_final.display(),
            logs.len()
        );
    }

    #[test]
    fn nfr_sync_profile_ui_aligned() {
        const SAMPLE_SKILLS: usize = 100;
        const ROOT_COUNT: usize = 3;
        const FILE_SIZE_BYTES: usize = 10 * 1024;
        const BATCH_IMPORT_COUNT: usize = 100;
        const INCREMENTAL_TOUCH_COUNT: usize = 10;

        let temp = tempdir().expect("tempdir");
        let source_roots = (0..ROOT_COUNT)
            .map(|idx| temp.path().join(format!("sync-root-{idx}")))
            .collect::<Vec<_>>();
        for root in &source_roots {
            fs::create_dir_all(root).expect("create source root");
        }

        let payload = "A".repeat(FILE_SIZE_BYTES);
        for idx in 0..SAMPLE_SKILLS {
            let root_idx = idx % ROOT_COUNT;
            let skill_dir = source_roots[root_idx].join(format!("skill-{idx:03}"));
            fs::create_dir_all(&skill_dir).expect("create skill dir");
            fs::write(
                skill_dir.join("SKILL.md"),
                format!("---\nname: sync-{idx:03}\n---\n{payload}\n"),
            )
            .expect("write skill");
        }

        let db_path = temp.path().join("sync-profile.db");
        let startup_begin = Instant::now();
        db::init(&db_path).expect("init db");
        let registry = AdapterRegistry::new();
        let allowed_roots = registry.default_roots();
        let _state = AppState::new(db_path.clone(), registry.clone(), allowed_roots);
        let cold_start_ms = startup_begin.elapsed().as_secs_f64() * 1000.0;

        let roots = source_roots
            .iter()
            .map(|root| root.to_string_lossy().to_string())
            .collect::<Vec<_>>();

        let scan_begin = Instant::now();
        let (skills_first, _) =
            scan_service::scan_registry(&registry, Some(roots.clone())).expect("first scan");
        let first_scan_ms = scan_begin.elapsed().as_secs_f64() * 1000.0;
        let discovered_count = skills_first.len();

        let index_begin = Instant::now();
        index_service::upsert_skills(&db_path, &skills_first).expect("first index");
        let first_index_ms = index_begin.elapsed().as_secs_f64() * 1000.0;

        for idx in 0..INCREMENTAL_TOUCH_COUNT {
            let root_idx = idx % ROOT_COUNT;
            let skill_file = source_roots[root_idx]
                .join(format!("skill-{idx:03}"))
                .join("SKILL.md");
            fs::write(
                skill_file,
                format!("---\nname: sync-{idx:03}\n---\n{payload}-changed\n"),
            )
            .expect("touch skill");
        }

        let incremental_begin = Instant::now();
        let (skills_incremental, _) =
            scan_service::scan_registry(&registry, Some(roots)).expect("incremental scan");
        index_service::upsert_skills(&db_path, &skills_incremental).expect("incremental index");
        let incremental_refresh_ms = incremental_begin.elapsed().as_secs_f64() * 1000.0;

        let import_source_root = temp.path().join("sync-import-source");
        let import_target_root = temp.path().join("sync-import-target");
        fs::create_dir_all(&import_source_root).expect("create import source");
        fs::create_dir_all(&import_target_root).expect("create import target");
        for idx in 0..BATCH_IMPORT_COUNT {
            fs::write(
                import_source_root.join(format!("item-{idx:03}.md")),
                payload.as_bytes(),
            )
            .expect("write import sample");
        }

        let import_begin = Instant::now();
        for idx in 0..BATCH_IMPORT_COUNT {
            let source_path = import_source_root.join(format!("item-{idx:03}.md"));
            TransferService::import_skill(&source_path, &import_target_root).expect("import item");
        }
        let import_secs = import_begin.elapsed().as_secs_f64();
        let import_throughput = if import_secs > 0.0 {
            BATCH_IMPORT_COUNT as f64 / import_secs
        } else {
            f64::INFINITY
        };

        let conflict_source = import_source_root.join("item-000.md");
        let conflict_existing = import_target_root.join("item-000.md");
        let conflict_final = ConflictService::resolve(
            &conflict_source,
            &conflict_existing,
            ConflictMode::SideBySide,
            None,
        )
        .expect("resolve conflict");

        for op in [
            "scan_roots",
            "build_index",
            "preview_skill",
            "import_skill",
            "export_skill",
            "resolve_conflict",
        ] {
            audit_log::write_log(&db_path, op, "ok", "sync profile", None).expect("write log");
        }
        let logs = audit_log::list_logs(&db_path, 20).expect("list logs");

        println!(
            "NFR_SYNC_PROFILE build_tag=v0.1.0-debug roots={} sample_skills={} file_size_bytes={} cold_start_ms={:.2} first_scan_ms={:.2} first_scan_entries={} first_index_ms={:.2} incremental_refresh_ms={:.2} batch_import_throughput_per_sec={:.2} conflict_final_path={} logs_count={}",
            ROOT_COUNT,
            SAMPLE_SKILLS,
            FILE_SIZE_BYTES,
            cold_start_ms,
            first_scan_ms,
            discovered_count,
            first_index_ms,
            incremental_refresh_ms,
            import_throughput,
            conflict_final.display(),
            logs.len()
        );
    }
}
