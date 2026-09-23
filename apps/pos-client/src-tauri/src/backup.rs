use chrono::{TimeZone, Utc};
use std::fs;
use tauri::AppHandle;

/// Generates a backup filename based on the provided UNIX timestamp (in seconds).
/// The format is `plinth-backup-YYYYMMDD-HHMMSS.db` in UTC.
#[must_use]
#[allow(clippy::cast_possible_wrap)]
pub fn backup_filename(now_secs: u64) -> String {
    let datetime = Utc.timestamp_opt(now_secs as i64, 0).unwrap();
    format!("plinth-backup-{}.db", datetime.format("%Y%m%d-%H%M%S"))
}

/// Given a list of backup filenames and a number to `keep`, returns the list
/// of older filenames that should be pruned (deleted).
/// This sorts the filenames alphabetically (which works for YYYYMMDD-HHMMSS).
#[must_use]
pub fn prune_list(mut files: Vec<String>, keep: usize) -> Vec<String> {
    files.sort();
    if files.len() <= keep {
        return Vec::new();
    }
    let prune_count = files.len() - keep;
    files.into_iter().take(prune_count).collect()
}

/// Tauri command to trigger a database backup.
/// Copies the current database file to a timestamped backup file
/// and prunes old backups to keep only the 7 most recent.
///
/// # Errors
///
/// Returns a string describing the error if the database file does not exist,
/// if the backup path is invalid, or if the copy operation fails.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
#[allow(clippy::cast_sign_loss)]
pub fn backup_now(app: AppHandle) -> Result<(), String> {
    let db_path = crate::state::db_path(&app)?;
    if !db_path.exists() {
        return Err("Database file does not exist".to_string());
    }

    let backup_dir = db_path.parent().ok_or("Invalid database path")?;
    let now_secs = Utc::now().timestamp() as u64;
    let backup_file_name = backup_filename(now_secs);
    let backup_path = backup_dir.join(&backup_file_name);

    fs::copy(&db_path, &backup_path).map_err(|e| e.to_string())?;

    // Prune old backups
    let mut backup_files = Vec::new();
    if let Ok(entries) = fs::read_dir(backup_dir) {
        for entry in entries.flatten() {
            if let Ok(file_type) = entry.file_type() {
                if file_type.is_file() {
                    let file_name = entry.file_name().to_string_lossy().to_string();
                    if file_name.starts_with("plinth-backup-") && std::path::Path::new(&file_name).extension().is_some_and(|ext| ext.eq_ignore_ascii_case("db")) {
                        backup_files.push(file_name);
                    }
                }
            }
        }
    }

    let files_to_delete = prune_list(backup_files, 7);
    for file_to_delete in files_to_delete {
        let path_to_delete = backup_dir.join(file_to_delete);
        let _ = fs::remove_file(path_to_delete);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backup_filename() {
        // 1_609_459_200 is 2021-01-01 00:00:00 UTC
        let filename = backup_filename(1_609_459_200);
        assert_eq!(filename, "plinth-backup-20210101-000000.db");
    }

    #[test]
    fn test_prune_list() {
        let files = vec![
            "plinth-backup-20230101-000000.db".to_string(),
            "plinth-backup-20230102-000000.db".to_string(),
            "plinth-backup-20230103-000000.db".to_string(),
            "plinth-backup-20230104-000000.db".to_string(),
        ];

        let pruned_keep_2 = prune_list(files.clone(), 2);
        assert_eq!(
            pruned_keep_2,
            vec![
                "plinth-backup-20230101-000000.db".to_string(),
                "plinth-backup-20230102-000000.db".to_string()
            ]
        );

        let pruned_keep_4 = prune_list(files.clone(), 4);
        assert!(pruned_keep_4.is_empty());

        let pruned_keep_5 = prune_list(files.clone(), 5);
        assert!(pruned_keep_5.is_empty());
    }
}
#[allow(clippy::cast_sign_loss)]
#[cfg(test)]
mod command_tests {
    use super::*;
    use std::fs::File;
    use std::env;

    #[test]
    fn test_backup_rotation() {
        // We will simulate the `backup_now` internal logic on a temporary directory.
        // `backup_now` relies on `AppHandle` so we can't test it directly easily, but we can test the FS rotation logic.
        let temp_dir = env::temp_dir().join(format!("plinth-backup-test-{}", std::process::id()));
        fs::create_dir_all(&temp_dir).expect("create temp dir");

        let mock_db_path = temp_dir.join("pos.db");
        File::create(&mock_db_path).expect("create mock db");

        // Create 10 dummy old backups
        for i in 1..=10 {
            let filename = format!("plinth-backup-20230101-0000{i:02}.db");
            File::create(temp_dir.join(&filename)).expect("create dummy backup");
        }

        // Run the pruning logic inline to simulate what `backup_now` does.
        let now_secs = Utc::now().timestamp() as u64;
        let backup_file_name = backup_filename(now_secs);
        let backup_path = temp_dir.join(&backup_file_name);
        fs::copy(&mock_db_path, &backup_path).expect("copy mock db");

        let mut backup_files = Vec::new();
        if let Ok(entries) = fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                if let Ok(file_type) = entry.file_type() {
                    if file_type.is_file() {
                        let file_name = entry.file_name().to_string_lossy().to_string();
                        if file_name.starts_with("plinth-backup-") && std::path::Path::new(&file_name).extension().is_some_and(|ext| ext.eq_ignore_ascii_case("db")) {
                            backup_files.push(file_name);
                        }
                    }
                }
            }
        }

        let files_to_delete = prune_list(backup_files, 7);
        for file_to_delete in files_to_delete {
            let path_to_delete = temp_dir.join(file_to_delete);
            let _ = fs::remove_file(path_to_delete);
        }

        // Check the number of backups left
        let mut remaining_backups = 0;
        if let Ok(entries) = fs::read_dir(&temp_dir) {
            for entry in entries.flatten() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with("plinth-backup-") && std::path::Path::new(&file_name).extension().is_some_and(|ext| ext.eq_ignore_ascii_case("db")) {
                    remaining_backups += 1;
                }
            }
        }

        assert_eq!(remaining_backups, 7);

        // Cleanup
        fs::remove_dir_all(&temp_dir).expect("cleanup temp dir");
    }
}
