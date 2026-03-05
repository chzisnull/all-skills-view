use anyhow::anyhow;
use serde::{Deserialize, Serialize};
use std::fmt;
use std::str::FromStr;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum Platform {
    Openclaw,
    Opencode,
    Codex,
    Claudcode,
    Cursor,
}

impl Platform {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Openclaw => "openclaw",
            Self::Opencode => "opencode",
            Self::Codex => "codex",
            Self::Claudcode => "claudcode",
            Self::Cursor => "cursor",
        }
    }
}

impl fmt::Display for Platform {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

impl FromStr for Platform {
    type Err = anyhow::Error;

    fn from_str(value: &str) -> Result<Self, Self::Err> {
        match value {
            "openclaw" => Ok(Self::Openclaw),
            "opencode" => Ok(Self::Opencode),
            "codex" => Ok(Self::Codex),
            "claudcode" => Ok(Self::Claudcode),
            "cursor" => Ok(Self::Cursor),
            other => Err(anyhow!("unknown platform: {other}")),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawSkill {
    pub platform: Platform,
    pub name: String,
    pub scope: String,
    pub root_path: String,
    pub entry_path: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CanonicalSkill {
    pub id: String,
    pub platform: Platform,
    pub name: String,
    pub description: Option<String>,
    pub scope: String,
    pub root_path: String,
    pub entry_path: String,
    pub content_hash: String,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanResponse {
    pub skills: Vec<CanonicalSkill>,
    pub scanned_roots: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildIndexResponse {
    pub indexed_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillArtifact {
    pub rel_path: String,
    pub kind: String,
    pub size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreviewSkillResponse {
    pub skill: CanonicalSkill,
    pub content: String,
    pub artifacts: Vec<SkillArtifact>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OperationLogRecord {
    pub id: i64,
    pub operation_type: String,
    pub status: String,
    pub message: String,
    pub metadata: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandError {
    pub code: String,
    pub message: String,
    pub details: Option<String>,
}

impl CommandError {
    pub fn new(
        code: impl Into<String>,
        message: impl Into<String>,
        details: Option<String>,
    ) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
            details,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferSkillResponse {
    pub operation: String,
    pub status: String,
    pub final_path: String,
    pub conflict_mode: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResolveConflictResponse {
    pub status: String,
    pub mode: String,
    pub final_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillCopyTarget {
    pub tool: String,
    pub scope: String,
    pub target_path: String,
    // Backward-compatible mirror field for existing UI integrations.
    pub path: String,
    pub exists: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ListSkillTargetsResponse {
    pub targets: Vec<SkillCopyTarget>,
}
