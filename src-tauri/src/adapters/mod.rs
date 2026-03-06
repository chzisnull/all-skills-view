mod claudcode;
mod codex;
mod cursor;
mod openclaw;
mod opencode;

use crate::models::{CanonicalSkill, Platform, RawSkill};
use anyhow::Result;
use dirs::home_dir;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

pub use claudcode::ClaudeCodeAdapter;
pub use codex::CodexAdapter;
pub use cursor::CursorAdapter;
pub use openclaw::OpenClawAdapter;
pub use opencode::OpenCodeAdapter;

pub trait SkillAdapter: Send + Sync {
    fn platform(&self) -> Platform;
    fn default_roots(&self) -> Vec<PathBuf>;
    fn discover(&self, roots: &[PathBuf]) -> Result<Vec<RawSkill>>;
    fn normalize(&self, raw: RawSkill) -> Result<CanonicalSkill>;
    fn import(&self, _source_path: &Path, _target_root: &Path) -> Result<()> {
        anyhow::bail!("TODO: import is not implemented for {}", self.platform())
    }
    fn export(&self, _entry_path: &Path, _target_dir: &Path) -> Result<()> {
        anyhow::bail!("TODO: export is not implemented for {}", self.platform())
    }
}

#[derive(Clone)]
pub struct AdapterRegistry {
    adapters: Vec<Arc<dyn SkillAdapter>>,
}

impl AdapterRegistry {
    pub fn new() -> Self {
        Self {
            adapters: vec![
                Arc::new(OpenClawAdapter),
                Arc::new(OpenCodeAdapter),
                Arc::new(CodexAdapter),
                Arc::new(ClaudeCodeAdapter),
                Arc::new(CursorAdapter),
            ],
        }
    }

    pub fn adapters(&self) -> Vec<Arc<dyn SkillAdapter>> {
        self.adapters.clone()
    }

    pub fn platforms(&self) -> Vec<Platform> {
        self.adapters.iter().map(|a| a.platform()).collect()
    }

    pub fn default_roots(&self) -> Vec<PathBuf> {
        let mut roots = Vec::new();
        let mut seen = HashSet::new();
        for adapter in &self.adapters {
            for root in adapter.default_roots() {
                let root = root;
                let key = root.to_string_lossy().to_string();
                if seen.insert(key) {
                    roots.push(root);
                }
            }
        }
        roots
    }
}

pub(crate) fn current_dir() -> PathBuf {
    std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
}

pub(crate) fn home() -> Option<PathBuf> {
    home_dir()
}

pub(crate) fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

pub(crate) fn read_description(path: &Path) -> Option<String> {
    let content = fs::read_to_string(path).ok()?;
    const ZH_KEYS: &[&str] = &[
        "description_zh",
        "zh_description",
        "description_cn",
        "cn_description",
        "descriptionzh",
        "summary_zh",
        "zh_summary",
        "作用",
        "用途",
        "说明",
        "简介",
    ];
    const EN_KEYS: &[&str] = &["description", "summary", "purpose", "intro", "introduction"];

    if let Some(value) = read_frontmatter_value(&content, ZH_KEYS) {
        return Some(value);
    }
    if let Some(value) = read_frontmatter_value(&content, EN_KEYS) {
        return Some(value);
    }

    let mut in_frontmatter = false;
    let mut frontmatter_started = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "---" {
            if !frontmatter_started {
                frontmatter_started = true;
            }
            in_frontmatter = !in_frontmatter;
            continue;
        }
        if in_frontmatter || trimmed.is_empty() {
            continue;
        }
        if frontmatter_started && trimmed.contains(':') {
            continue;
        }
        if trimmed.starts_with('#') {
            continue;
        }
        return Some(trimmed.to_string());
    }
    None
}

fn read_frontmatter_value(content: &str, keys: &[&str]) -> Option<String> {
    let lines: Vec<&str> = content.lines().collect();
    let mut frontmatter_started = false;
    let mut in_frontmatter = false;
    let mut index = 0;

    while index < lines.len() {
        let line = lines[index];
        let trimmed = line.trim();
        if !frontmatter_started {
            if trimmed.is_empty() {
                index += 1;
                continue;
            }
            if trimmed == "---" {
                frontmatter_started = true;
                in_frontmatter = true;
                index += 1;
                continue;
            }
            return None;
        }

        if in_frontmatter {
            if trimmed == "---" {
                break;
            }
            if let Some(value) = parse_frontmatter_line(&lines, &mut index, keys) {
                return Some(value);
            }
        }

        index += 1;
    }

    None
}

fn parse_frontmatter_line(lines: &[&str], index: &mut usize, keys: &[&str]) -> Option<String> {
    let line = lines[*index].trim();
    let (raw_key, raw_value) = line.split_once(':')?;
    let key = raw_key.trim();

    if !keys
        .iter()
        .any(|expected| key.eq_ignore_ascii_case(expected) || key == *expected)
    {
        return None;
    }

    let value = raw_value.trim();
    if value == ">" || value == "|" {
        return parse_multiline_frontmatter_value(lines, index, value == "|");
    }

    let value = value.trim_matches('"').trim_matches('\'').trim();
    if value.is_empty() {
        return None;
    }

    Some(value.to_string())
}

fn parse_multiline_frontmatter_value(
    lines: &[&str],
    index: &mut usize,
    preserve_newlines: bool,
) -> Option<String> {
    let base_indent = leading_whitespace(lines[*index]);
    let mut cursor = *index + 1;
    let mut collected = Vec::new();

    while cursor < lines.len() {
        let raw_line = lines[cursor];
        let trimmed = raw_line.trim();

        if trimmed == "---" {
            break;
        }

        if trimmed.is_empty() {
            collected.push(String::new());
            cursor += 1;
            continue;
        }

        let indent = leading_whitespace(raw_line);
        if indent <= base_indent {
            break;
        }

        collected.push(raw_line[indent..].trim_end().to_string());
        cursor += 1;
    }

    if collected.is_empty() {
        return None;
    }

    *index = cursor.saturating_sub(1);

    if preserve_newlines {
        let value = collected.join("\n").trim().to_string();
        if value.is_empty() {
            None
        } else {
            Some(value)
        }
    } else {
        let value = collected
            .into_iter()
            .filter(|line| !line.trim().is_empty())
            .collect::<Vec<_>>()
            .join(" ")
            .trim()
            .to_string();
        if value.is_empty() {
            None
        } else {
            Some(value)
        }
    }
}

fn leading_whitespace(line: &str) -> usize {
    line.chars().take_while(|char| char.is_whitespace()).count()
}

pub(crate) fn build_canonical(raw: RawSkill) -> Result<CanonicalSkill> {
    let entry_path = PathBuf::from(&raw.entry_path);
    let content_hash = if entry_path.exists() {
        let bytes = fs::read(&entry_path)?;
        sha256_hex(&bytes)
    } else {
        sha256_hex(raw.entry_path.as_bytes())
    };

    let updated_at = fs::metadata(&entry_path)
        .and_then(|m| m.modified())
        .ok()
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or_else(now_ts);

    let id = sha256_hex(format!("{}:{}", raw.platform, raw.entry_path).as_bytes());

    Ok(CanonicalSkill {
        id,
        platform: raw.platform,
        name: raw.name,
        description: raw.description,
        scope: raw.scope,
        root_path: raw.root_path,
        entry_path: raw.entry_path,
        content_hash,
        updated_at,
    })
}

pub(crate) fn sha256_hex(bytes: impl AsRef<[u8]>) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes.as_ref());
    format!("{:x}", hasher.finalize())
}

pub(crate) fn dedupe_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut seen = HashSet::new();
    let mut unique = Vec::new();
    for path in paths {
        let key = path.to_string_lossy().to_string();
        if seen.insert(key) {
            unique.push(path);
        }
    }
    unique
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn adapter_registry_has_five_platforms() {
        let registry = AdapterRegistry::new();
        assert_eq!(registry.adapters().len(), 5);
    }

    #[test]
    fn adapters_normalize_smoke_test() {
        let registry = AdapterRegistry::new();
        for adapter in registry.adapters() {
            let platform = adapter.platform();
            let raw = RawSkill {
                platform: platform.clone(),
                name: "demo-skill".to_string(),
                scope: "user".to_string(),
                root_path: "/tmp".to_string(),
                entry_path: "/tmp/demo-skill/SKILL.md".to_string(),
                description: Some("Demo".to_string()),
            };

            let normalized = adapter.normalize(raw).expect("normalize must succeed");
            assert_eq!(normalized.platform, platform);
            assert_eq!(normalized.name, "demo-skill");
            assert!(!normalized.id.is_empty());
        }
    }

    #[test]
    fn read_description_prefers_chinese_frontmatter() {
        let temp = tempdir().expect("create tempdir");
        let skill_file = temp.path().join("SKILL.md");
        fs::write(
            &skill_file,
            "---\nname: demo\ndescription: english desc\ndescription_zh: 中文作用说明\n---\n# title\nbody",
        )
        .expect("write skill");

        let description = read_description(&skill_file).expect("read description");
        assert_eq!(description, "中文作用说明");
    }

    #[test]
    fn read_description_uses_english_frontmatter_when_no_chinese() {
        let temp = tempdir().expect("create tempdir");
        let skill_file = temp.path().join("SKILL.md");
        fs::write(
            &skill_file,
            "---\nname: demo\ndescription: scan and sync skills\n---\n# title\nbody",
        )
        .expect("write skill");

        let description = read_description(&skill_file).expect("read description");
        assert_eq!(description, "scan and sync skills");
    }

    #[test]
    fn read_description_supports_folded_multiline_frontmatter() {
        let temp = tempdir().expect("create tempdir");
        let skill_file = temp.path().join("SKILL.md");
        fs::write(
            &skill_file,
            "---\nname: demo\ndescription: >\n  Use the internet: search, read, and interact with 13+ platforms including\n  Twitter/X, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu (小红书), Douyin (抖音),\n  WeChat Articles (微信公众号), LinkedIn, Boss直聘, RSS, Exa web search, and any web page.\n---\n# title\nbody",
        )
        .expect("write skill");

        let description = read_description(&skill_file).expect("read description");
        assert_eq!(
            description,
            "Use the internet: search, read, and interact with 13+ platforms including Twitter/X, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu (小红书), Douyin (抖音), WeChat Articles (微信公众号), LinkedIn, Boss直聘, RSS, Exa web search, and any web page.",
        );
    }

    #[test]
    fn read_description_supports_literal_multiline_frontmatter() {
        let temp = tempdir().expect("create tempdir");
        let skill_file = temp.path().join("SKILL.md");
        fs::write(
            &skill_file,
            "---\nname: demo\ndescription: |\n  first line\n  second line\n---\n# title\nbody",
        )
        .expect("write skill");

        let description = read_description(&skill_file).expect("read description");
        assert_eq!(description, "first line\nsecond line");
    }
}
