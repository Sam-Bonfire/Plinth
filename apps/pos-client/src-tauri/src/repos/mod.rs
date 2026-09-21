#![forbid(unsafe_code)]

pub mod audit;
pub mod kitchen;
pub mod menu;
pub mod order;

pub use audit::SqliteAuditRepository;
pub use kitchen::SqliteKitchenTicketRepository;
pub use menu::SqliteMenuRepository;
pub use order::SqliteOrderRepository;

use chrono::{DateTime, Utc};
use core_domain::ports::PortError;
use core_domain::value_objects::money::{Currency, Money};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use uuid::Uuid;

pub(crate) fn open(db_path: &Path) -> Result<Connection, PortError> {
    Connection::open(db_path).map_err(|e| PortError::StorageUnavailable {
        reason: e.to_string(),
    })
}

pub(crate) fn minor(amount_minor: i64) -> Money {
    Money::from_minor_units(amount_minor, Currency::Inr)
}

pub(crate) fn id_from_text<T: From<Uuid>>(text: &str) -> Result<T, PortError> {
    Uuid::parse_str(text)
        .map(T::from)
        .map_err(|e| PortError::Internal {
            message: format!("bad id {text}: {e}"),
        })
}

pub(crate) fn from_json<'a, T: Deserialize<'a>>(text: &'a str) -> Result<T, PortError> {
    serde_json::from_str(text).map_err(|e| PortError::Internal {
        message: format!("bad json {text}: {e}"),
    })
}

pub(crate) fn to_json<T: Serialize>(value: &T) -> Result<String, PortError> {
    serde_json::to_string(value).map_err(|e| PortError::Internal {
        message: format!("json encode failed: {e}"),
    })
}

pub(crate) fn time_from_text(text: &str) -> Result<DateTime<Utc>, PortError> {
    DateTime::parse_from_rfc3339(text)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|e| PortError::Internal {
            message: format!("bad timestamp {text}: {e}"),
        })
}

pub(crate) fn opt_time_from_text(text: Option<String>) -> Result<Option<DateTime<Utc>>, PortError> {
    text.map(|s| time_from_text(&s)).transpose()
}

/// File-backed SQLite repository base. Each call opens a short-lived
/// connection; no connection is held across `.await` points.
#[derive(Debug, Clone)]
pub(crate) struct Store {
    pub db_path: PathBuf,
}

impl Store {
    pub fn new(db_path: PathBuf) -> Self {
        Self { db_path }
    }

    pub fn conn(&self) -> Result<Connection, PortError> {
        open(&self.db_path)
    }
}

#[cfg(test)]
pub(crate) mod tests {
    use super::*;
    use crate::migrations::migrate;

    pub fn temp_path(tag: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "plinth-repo-test-{tag}-{}-{}.db",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("clock")
                .as_nanos()
        ));
        path
    }

    pub fn migrated_file_db(tag: &str) -> (Connection, PathBuf) {
        let path = temp_path(tag);
        let mut conn = Connection::open(&path).expect("open db");
        migrate(&mut conn).expect("migrate");
        (conn, path)
    }

    pub fn cleanup(path: &Path) {
        let _ = std::fs::remove_file(path);
        for suffix in ["-wal", "-shm", "-journal"] {
            let mut sidecar = path.as_os_str().to_owned();
            sidecar.push(suffix);
            let _ = std::fs::remove_file(std::path::Path::new(&sidecar));
        }
    }
}
