use core_domain::ids::{LocationId, TenantId};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Debug, Clone)]
pub struct AppContext {
    pub tenant_id: TenantId,
    pub location_id: LocationId,
}

impl Default for AppContext {
    /// Bootstrap context with nil IDs. The login flow replaces these with
    /// the authenticated tenant/location before any command runs.
    fn default() -> Self {
        Self {
            tenant_id: TenantId::from(Uuid::nil()),
            location_id: LocationId::from(Uuid::nil()),
        }
    }
}

/// Local `SQLite` path shared by all commands.
///
/// # Errors
/// Returns an error if the platform data directory is unavailable.
pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    path.push("pos.db");
    Ok(path)
}
