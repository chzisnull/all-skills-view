use crate::adapters::AdapterRegistry;
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::RwLock;

pub struct AppState {
    pub db_path: PathBuf,
    pub adapter_registry: AdapterRegistry,
    allowed_roots: RwLock<Vec<PathBuf>>,
}

impl AppState {
    pub fn new(
        db_path: PathBuf,
        adapter_registry: AdapterRegistry,
        allowed_roots: Vec<PathBuf>,
    ) -> Self {
        Self {
            db_path,
            adapter_registry,
            allowed_roots: RwLock::new(allowed_roots),
        }
    }

    pub fn merge_allowed_roots(&self, new_roots: Vec<PathBuf>) {
        if let Ok(mut guard) = self.allowed_roots.write() {
            let mut seen: HashSet<String> = guard
                .iter()
                .map(|p| p.to_string_lossy().to_string())
                .collect();
            for root in new_roots {
                let key = root.to_string_lossy().to_string();
                if seen.insert(key) {
                    guard.push(root);
                }
            }
        }
    }

    pub fn allowed_roots(&self) -> Vec<PathBuf> {
        self.allowed_roots
            .read()
            .map(|g| g.clone())
            .unwrap_or_default()
    }
}
