#![deny(unsafe_code)]

use crate::printing::spooler::Spooler;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

/// Enqueues a receipt payload for printing, returning the job id.
///
/// # Errors
/// Returns an error if the payload is empty.
#[tauri::command]
pub fn print_receipt(spooler: State<'_, Mutex<Spooler>>, payload: Vec<u8>) -> Result<String, String> {
    if payload.is_empty() {
        return Err("Receipt payload cannot be empty".to_string());
    }
    let id = format!("print-{}", now_ms());
    spooler
        .lock()
        .map_err(|e| format!("Print queue unavailable: {e}"))?
        .enqueue(id.clone(), payload, now_ms());
    Ok(id)
}

/// Returns the number of print jobs awaiting dispatch.
///
/// # Errors
/// Returns an error if the queue lock is unavailable.
#[tauri::command]
pub fn print_queue_depth(spooler: State<'_, Mutex<Spooler>>) -> Result<usize, String> {
    spooler
        .lock()
        .map(|s| s.pending_count())
        .map_err(|e| format!("Print queue unavailable: {e}"))
}
