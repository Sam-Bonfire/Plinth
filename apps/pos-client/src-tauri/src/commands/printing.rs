#![deny(unsafe_code)]

use crate::printing::spooler::Spooler;
use core_domain::services::esc_pos::{EscPosDoc, EscPosLine, receipt_bytes};
use core_domain::value_objects::money::{Currency, Money};
use serde::Deserialize;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

fn now_ms() -> u64 {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |d| d.as_millis());
    u64::try_from(millis).unwrap_or(0)
}

/// Enqueues a receipt payload for printing, returning the job id.
///
/// # Errors
/// Returns an error if the payload is empty.
#[tauri::command]
#[allow(clippy::needless_pass_by_value, reason = "Tauri injects State by value")]
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

/// One receipt line in minor currency units (no floats cross the IPC boundary).
#[derive(Debug, Clone, Deserialize)]
pub struct ReceiptLineDto {
    pub name: String,
    pub qty: u32,
    pub unit_minor: i64,
    pub total_minor: i64,
}

/// Builds ESC/POS receipt bytes from structured lines (pure, unit-tested).
#[must_use]
pub fn build_receipt_bytes(
    header: &[String],
    lines: &[ReceiptLineDto],
    footer: &[String],
    grand_total_minor: i64,
) -> Vec<u8> {
    let doc = EscPosDoc {
        header: header.to_vec(),
        lines: lines
            .iter()
            .map(|l| EscPosLine {
                name: l.name.clone(),
                qty: l.qty,
                unit: Money::from_minor_units(l.unit_minor, Currency::Inr),
                total: Money::from_minor_units(l.total_minor, Currency::Inr),
            })
            .collect(),
        footer: footer.to_vec(),
    };
    receipt_bytes(&doc, &Money::from_minor_units(grand_total_minor, Currency::Inr))
}

/// Builds ESC/POS receipt bytes for an order and enqueues them for dispatch.
///
/// # Errors
/// Returns an error if no lines are given or the queue lock is unavailable.
#[tauri::command]
#[allow(clippy::needless_pass_by_value, reason = "Tauri injects State by value")]
pub fn print_receipt_doc(
    spooler: State<'_, Mutex<Spooler>>,
    header: Vec<String>,
    lines: Vec<ReceiptLineDto>,
    footer: Vec<String>,
    grand_total_minor: i64,
) -> Result<String, String> {
    if lines.is_empty() {
        return Err("Receipt lines cannot be empty".to_string());
    }
    let payload = build_receipt_bytes(&header, &lines, &footer, grand_total_minor);
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
#[allow(clippy::needless_pass_by_value, reason = "Tauri injects State by value")]
pub fn print_queue_depth(spooler: State<'_, Mutex<Spooler>>) -> Result<usize, String> {
    spooler
        .lock()
        .map(|s| s.pending_count())
        .map_err(|e| format!("Print queue unavailable: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn line(name: &str, qty: u32, unit_minor: i64, total_minor: i64) -> ReceiptLineDto {
        ReceiptLineDto {
            name: name.to_string(),
            qty,
            unit_minor,
            total_minor,
        }
    }

    #[test]
    fn receipt_doc_emits_escpos_bytes() {
        let bytes = build_receipt_bytes(
            &["PLINTH POS".to_string()],
            &[line("Masala Dosa", 2, 12000, 24000)],
            &["Thank you".to_string()],
            24000,
        );
        assert_eq!(&bytes[..2], &[0x1B, 0x40]);
        assert_eq!(&bytes[bytes.len() - 5..], &[0x0A, 0x0A, 0x1D, 0x56, 0x00]);
        let text = String::from_utf8_lossy(&bytes);
        assert!(text.contains("Masala Dosa x2"));
        assert!(text.contains("TOTAL: Rs 240.00"));
    }
}
