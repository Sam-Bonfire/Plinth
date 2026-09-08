use rusqlite::{Connection, Result};
use std::path::Path;

/// Opens (creating if needed) the POS local SQLite database and applies the
/// bundled durability pragmas: WAL journaling, foreign-key enforcement, and
/// NORMAL synchronous mode.
///
/// Schema itself is owned by the migrations engine (follow-up task); this
/// module only guarantees the file exists with the expected pragmas.
///
/// # Errors
///
/// Returns [`rusqlite::Error`] if the file cannot be opened/created or any
/// pragma update fails.
pub fn open_db(path: impl AsRef<Path>) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.pragma_update(None, "journal_mode", "WAL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    conn.pragma_update(None, "synchronous", "NORMAL")?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::params;

    fn temp_db_path(tag: &str) -> std::path::PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "plinth-pos-test-{}-{}-{}.db",
            tag,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .expect("system clock before epoch")
                .as_nanos()
        ));
        path
    }

    fn cleanup_db(path: &std::path::Path) {
        let _ = std::fs::remove_file(path);
        for suffix in ["-wal", "-shm", "-journal"] {
            let mut sidecar = path.as_os_str().to_owned();
            sidecar.push(suffix);
            let _ = std::fs::remove_file(std::path::Path::new(&sidecar));
        }
    }

    fn pragma(conn: &Connection, name: &str) -> String {
        conn.query_row(&format!("PRAGMA {name}"), params![], |row| {
            row.get(0)
        })
        .expect("pragma readable")
    }

    #[test]
    fn opens_with_wal_and_fk_pragmas() {
        let path = temp_db_path("wal");
        let conn = open_db(&path).expect("open db");
        assert_eq!(pragma(&conn, "journal_mode").to_lowercase(), "wal");
        let foreign_keys: i64 = conn
            .query_row("PRAGMA foreign_keys", params![], |row| row.get(0))
            .expect("pragma readable");
        assert_eq!(foreign_keys, 1);
        let synchronous: i64 = conn
            .query_row("PRAGMA synchronous", params![], |row| row.get(0))
            .expect("pragma readable");
        assert_eq!(synchronous, 1, "NORMAL synchronous mode");
        drop(conn);
        cleanup_db(&path);
    }

    #[test]
    fn enforces_foreign_keys() {
        let path = temp_db_path("fk");
        let conn = open_db(&path).expect("open db");
        conn.execute_batch(
            "CREATE TABLE parent(id INTEGER PRIMARY KEY);
             CREATE TABLE child(id INTEGER PRIMARY KEY, parent_id INTEGER NOT NULL REFERENCES parent(id));",
        )
        .expect("create tables");
        let orphan = conn.execute(
            "INSERT INTO child(id, parent_id) VALUES (1, 999)",
            params![],
        );
        assert!(orphan.is_err(), "FK violation must be rejected");
        drop(conn);
        cleanup_db(&path);
    }
}
