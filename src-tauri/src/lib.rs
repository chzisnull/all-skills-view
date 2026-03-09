mod adapters;
mod app_state;
mod commands;
mod db;
mod models;
mod path_security;
mod services;

use anyhow::Result;
use app_state::AppState;
use std::fs;
use tauri::Manager;

fn initialize_state(app: &mut tauri::App) -> Result<()> {
    let app_data_dir = app.path().app_data_dir()?;
    fs::create_dir_all(&app_data_dir)?;

    let db_path = app_data_dir.join("skills-manager.db");
    db::init(&db_path)?;

    let adapter_registry = adapters::AdapterRegistry::new();
    let allowed_roots = adapter_registry.default_roots();
    app.manage(AppState::new(db_path, adapter_registry, allowed_roots));

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if let Err(err) = initialize_state(app) {
                let boxed: Box<dyn std::error::Error> =
                    Box::new(std::io::Error::other(err.to_string()));
                return Err(boxed);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::scan_roots,
            commands::build_index,
            commands::preview_skill,
            commands::preview_skill_by_path,
            commands::open_path,
            commands::list_logs,
            commands::translate_description,
            commands::list_skill_targets,
            commands::import_skill,
            commands::export_skill,
            commands::uninstall_skill,
            commands::resolve_conflict
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
