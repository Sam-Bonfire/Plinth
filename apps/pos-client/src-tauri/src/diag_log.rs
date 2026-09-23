use serde::{Deserialize, Serialize};
use std::collections::VecDeque;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct LogEntry {
    pub ts_ms: u64,
    pub level: LogLevel,
    pub tag: String,
    pub message: String,
}

#[derive(Debug)]
pub struct DiagLog {
    capacity: usize,
    entries: VecDeque<LogEntry>,
}

impl DiagLog {
    #[must_use]
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            entries: VecDeque::with_capacity(capacity),
        }
    }

    pub fn push(&mut self, entry: LogEntry) {
        if self.capacity == 0 {
            return;
        }
        if self.entries.len() == self.capacity {
            self.entries.pop_front();
        }
        self.entries.push_back(entry);
    }

    #[must_use]
    pub fn drain(&mut self) -> Vec<LogEntry> {
        self.entries.drain(..).collect()
    }

    #[must_use]
    pub fn export_text(&self) -> String {
        self.entries
            .iter()
            .map(|e| {
                format!(
                    "[{}] [{:?}] [{}] {}",
                    e.ts_ms, e.level, e.tag, e.message
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    }

    #[must_use]
    pub fn by_level(&self, level: &LogLevel) -> Vec<LogEntry> {
        self.entries
            .iter()
            .filter(|e| &e.level == level)
            .cloned()
            .collect()
    }
}

/// Pushes a new log entry to the diagnostic log.
///
/// # Errors
///
/// Returns an error if the mutex is poisoned.
#[tauri::command]
#[allow(clippy::needless_pass_by_value, reason = "Tauri injects owned command args")]
pub fn diag_push(
    state: tauri::State<'_, std::sync::Mutex<DiagLog>>,
    entry: LogEntry,
) -> Result<(), String> {
    let mut log = state.lock().map_err(|e| e.to_string())?;
    log.push(entry);
    Ok(())
}

/// Drains all log entries from the diagnostic log.
///
/// # Errors
///
/// Returns an error if the mutex is poisoned.
#[tauri::command]
#[allow(clippy::needless_pass_by_value, reason = "Tauri injects owned command args")]
pub fn diag_drain(
    state: tauri::State<'_, std::sync::Mutex<DiagLog>>,
) -> Result<Vec<LogEntry>, String> {
    let mut log = state.lock().map_err(|e| e.to_string())?;
    Ok(log.drain())
}

/// Exports all log entries as a formatted text string.
///
/// # Errors
///
/// Returns an error if the mutex is poisoned.
#[tauri::command]
#[allow(clippy::needless_pass_by_value, reason = "Tauri injects owned command args")]
pub fn diag_export(
    state: tauri::State<'_, std::sync::Mutex<DiagLog>>,
) -> Result<String, String> {
    let log = state.lock().map_err(|e| e.to_string())?;
    Ok(log.export_text())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_eviction_order() {
        let mut log = DiagLog::new(2);

        log.push(LogEntry { ts_ms: 1, level: LogLevel::Info, tag: "A".to_string(), message: "msg1".to_string() });
        log.push(LogEntry { ts_ms: 2, level: LogLevel::Info, tag: "B".to_string(), message: "msg2".to_string() });
        log.push(LogEntry { ts_ms: 3, level: LogLevel::Info, tag: "C".to_string(), message: "msg3".to_string() });

        let entries = log.drain();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].tag, "B");
        assert_eq!(entries[1].tag, "C");
    }

    #[test]
    fn test_by_level() {
        let mut log = DiagLog::new(5);
        log.push(LogEntry { ts_ms: 1, level: LogLevel::Info, tag: "A".to_string(), message: "msg".to_string() });
        log.push(LogEntry { ts_ms: 2, level: LogLevel::Warn, tag: "B".to_string(), message: "msg".to_string() });
        log.push(LogEntry { ts_ms: 3, level: LogLevel::Error, tag: "C".to_string(), message: "msg".to_string() });
        log.push(LogEntry { ts_ms: 4, level: LogLevel::Info, tag: "D".to_string(), message: "msg".to_string() });

        let infos = log.by_level(&LogLevel::Info);
        assert_eq!(infos.len(), 2);
        assert_eq!(infos[0].tag, "A");
        assert_eq!(infos[1].tag, "D");

        let warns = log.by_level(&LogLevel::Warn);
        assert_eq!(warns.len(), 1);
        assert_eq!(warns[0].tag, "B");
    }

    #[test]
    fn test_export_text() {
        let mut log = DiagLog::new(2);
        log.push(LogEntry { ts_ms: 100, level: LogLevel::Info, tag: "TAG1".to_string(), message: "Message 1".to_string() });
        log.push(LogEntry { ts_ms: 200, level: LogLevel::Error, tag: "TAG2".to_string(), message: "Message 2".to_string() });

        let text = log.export_text();
        let expected = "[100] [Info] [TAG1] Message 1\n[200] [Error] [TAG2] Message 2";
        assert_eq!(text, expected);
    }
}
