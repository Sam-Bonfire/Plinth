use core_domain::ids::{LocationId, TenantId};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

#[derive(Debug, Clone)]
pub struct AppContext {
    pub tenant_id: TenantId,
    pub location_id: LocationId,
}

/// Local SQLite path shared by all commands.
///
/// # Errors
/// Returns an error if the platform data directory is unavailable.
pub fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    let mut path = app.path().app_local_data_dir().map_err(|e| e.to_string())?;
    path.push("pos.db");
    Ok(path)
}
