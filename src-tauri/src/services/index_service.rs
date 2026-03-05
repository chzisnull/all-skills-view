use crate::adapters::sha256_hex;
use crate::db;
use crate::models::{CanonicalSkill, Platform, PreviewSkillResponse, SkillArtifact};
use anyhow::{anyhow, Result};
use rusqlite::params;
use std::fs;
use std::path::{Path, PathBuf};
use std::str::FromStr;
use std::time::{SystemTime, UNIX_EPOCH};
use walkdir::WalkDir;

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub fn upsert_skills(db_path: &Path, skills: &[CanonicalSkill]) -> Result<usize> {
    let mut conn = db::connection(db_path)?;
    let tx = conn.transaction()?;
    let indexed_at = now_ts();

    for skill in skills {
        tx.execute(
            r#"
            INSERT INTO skills (
                id, platform, name, description, scope, root_path, entry_path, content_hash, updated_at, indexed_at
            ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10
            )
            ON CONFLICT(id) DO UPDATE SET
                platform = excluded.platform,
                name = excluded.name,
                description = excluded.description,
                scope = excluded.scope,
                root_path = excluded.root_path,
                entry_path = excluded.entry_path,
                content_hash = excluded.content_hash,
                updated_at = excluded.updated_at,
                indexed_at = excluded.indexed_at
            "#,
            params![
                skill.id,
                skill.platform.as_str(),
                skill.name,
                skill.description,
                skill.scope,
                skill.root_path,
                skill.entry_path,
                skill.content_hash,
                skill.updated_at,
                indexed_at,
            ],
        )?;
    }

    tx.commit()?;
    Ok(skills.len())
}

pub fn preview_skill(db_path: &Path, skill_id: &str) -> Result<PreviewSkillResponse> {
    let conn = db::connection(db_path)?;
    let skill = conn.query_row(
        r#"
        SELECT id, platform, name, description, scope, root_path, entry_path, content_hash, updated_at
        FROM skills
        WHERE id = ?1
        "#,
        params![skill_id],
        |row| {
            let platform_text: String = row.get(1)?;
            let platform = Platform::from_str(&platform_text)
                .map_err(|_| rusqlite::Error::InvalidParameterName(platform_text.clone()))?;

            Ok(CanonicalSkill {
                id: row.get(0)?,
                platform,
                name: row.get(2)?,
                description: row.get(3)?,
                scope: row.get(4)?,
                root_path: row.get(5)?,
                entry_path: row.get(6)?,
                content_hash: row.get(7)?,
                updated_at: row.get(8)?,
            })
        },
    )?;

    let entry_path = PathBuf::from(&skill.entry_path);
    if !entry_path.exists() {
        return Err(anyhow!(
            "entry file does not exist: {}",
            entry_path.display()
        ));
    }

    let content = read_text_lossy(&entry_path)?;
    let skill_root = entry_path
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| PathBuf::from(&skill.root_path));
    let artifacts = collect_artifacts(&skill_root);

    Ok(PreviewSkillResponse {
        skill,
        content,
        artifacts,
    })
}

pub fn preview_skill_by_path(
    entry_path: &Path,
    platform: Option<Platform>,
    name: Option<&str>,
    scope: Option<&str>,
    root_path: Option<&Path>,
) -> Result<PreviewSkillResponse> {
    if !entry_path.exists() {
        return Err(anyhow!(
            "entry file does not exist: {}",
            entry_path.display()
        ));
    }

    let content = read_text_lossy(entry_path)?;
    let entry_path_text = entry_path.to_string_lossy().to_string();
    let skill_root = root_path
        .map(Path::to_path_buf)
        .or_else(|| entry_path.parent().map(Path::to_path_buf))
        .unwrap_or_else(|| entry_path.to_path_buf());

    let content_hash = sha256_hex(content.as_bytes());
    let updated_at = fs::metadata(entry_path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_else(now_ts);

    let inferred_name = name
        .map(|value| value.to_string())
        .or_else(|| {
            entry_path
                .parent()
                .and_then(|path| path.file_name())
                .map(|value| value.to_string_lossy().to_string())
        })
        .unwrap_or_else(|| "unnamed-skill".to_string());

    let skill = CanonicalSkill {
        id: sha256_hex(format!("fallback:{entry_path_text}")),
        platform: platform.unwrap_or(Platform::Openclaw),
        name: inferred_name,
        description: None,
        scope: scope.unwrap_or("project").to_string(),
        root_path: skill_root.to_string_lossy().to_string(),
        entry_path: entry_path_text,
        content_hash,
        updated_at,
    };

    let artifacts = collect_artifacts(&skill_root);

    Ok(PreviewSkillResponse {
        skill,
        content,
        artifacts,
    })
}

fn read_text_lossy(entry_path: &Path) -> Result<String> {
    let content_bytes = fs::read(entry_path)?;
    let content = match String::from_utf8(content_bytes) {
        Ok(value) => value,
        Err(err) => String::from_utf8_lossy(&err.into_bytes()).into_owned(),
    };
    Ok(content)
}

fn collect_artifacts(skill_root: &Path) -> Vec<SkillArtifact> {
    let mut artifacts = Vec::new();
    if skill_root.exists() {
        for entry in WalkDir::new(skill_root)
            .max_depth(2)
            .follow_links(false)
            .into_iter()
            .filter_map(|value| value.ok())
        {
            if !entry.file_type().is_file() {
                continue;
            }

            let path = entry.path();
            let rel_path = path
                .strip_prefix(skill_root)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();

            let kind = if rel_path == "SKILL.md" {
                "skill_doc"
            } else if rel_path.contains("scripts/") {
                "script"
            } else if rel_path.contains("references/") {
                "reference"
            } else if rel_path.ends_with(".md") || rel_path.ends_with(".mdc") {
                "doc"
            } else {
                "asset"
            }
            .to_string();

            let size = fs::metadata(path)
                .map(|metadata| metadata.len())
                .unwrap_or(0);
            artifacts.push(SkillArtifact {
                rel_path,
                kind,
                size,
            });
        }
    }

    artifacts
}
