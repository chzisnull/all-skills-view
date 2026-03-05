use anyhow::Result;
use rusqlite::Connection;
use std::path::Path;

pub fn init(db_path: &Path) -> Result<()> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = connection(db_path)?;
    run_migrations(&conn)?;
    Ok(())
}

pub fn connection(db_path: &Path) -> Result<Connection> {
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    Ok(conn)
}

fn run_migrations(conn: &Connection) -> Result<()> {
    conn.execute_batch(
        r#"
        CREATE TABLE IF NOT EXISTS skills (
            id TEXT PRIMARY KEY,
            platform TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            scope TEXT NOT NULL,
            root_path TEXT NOT NULL,
            entry_path TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            updated_at INTEGER NOT NULL,
            indexed_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_skills_platform_name ON skills(platform, name);
        CREATE INDEX IF NOT EXISTS idx_skills_entry_path ON skills(entry_path);

        CREATE TABLE IF NOT EXISTS imports (
            id TEXT PRIMARY KEY,
            source_platform TEXT NOT NULL,
            target_platform TEXT NOT NULL,
            skill_name TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS conflicts (
            id TEXT PRIMARY KEY,
            skill_id TEXT,
            existing_path TEXT NOT NULL,
            incoming_path TEXT NOT NULL,
            resolution TEXT NOT NULL,
            created_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS operation_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            operation_type TEXT NOT NULL,
            status TEXT NOT NULL,
            message TEXT NOT NULL,
            metadata TEXT,
            created_at INTEGER NOT NULL
        );
        "#,
    )?;
    Ok(())
}
