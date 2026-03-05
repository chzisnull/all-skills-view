use crate::db;
use crate::models::OperationLogRecord;
use anyhow::Result;
use rusqlite::params;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn write_log(
    db_path: &Path,
    operation_type: &str,
    status: &str,
    message: &str,
    metadata: Option<&str>,
) -> Result<()> {
    let conn = db::connection(db_path)?;
    conn.execute(
        r#"
        INSERT INTO operation_logs (operation_type, status, message, metadata, created_at)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
        params![operation_type, status, message, metadata, now_ts()],
    )?;
    Ok(())
}

pub fn list_logs(db_path: &Path, limit: usize) -> Result<Vec<OperationLogRecord>> {
    let conn = db::connection(db_path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT id, operation_type, status, message, metadata, created_at
        FROM operation_logs
        ORDER BY id DESC
        LIMIT ?1
        "#,
    )?;

    let rows = stmt.query_map(params![limit as i64], |row| {
        Ok(OperationLogRecord {
            id: row.get(0)?,
            operation_type: row.get(1)?,
            status: row.get(2)?,
            message: row.get(3)?,
            metadata: row.get(4)?,
            created_at: row.get(5)?,
        })
    })?;

    let mut result = Vec::new();
    for row in rows {
        result.push(row?);
    }

    Ok(result)
}
