#![deny(unsafe_code)]

use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Clone, Copy)]
pub struct IdleTracker {
    pub timeout_secs: u64,
    pub last_activity_ms: u64,
}

impl IdleTracker {
    #[must_use]
    pub fn new(timeout_secs: u64, initial_activity_ms: u64) -> Self {
        Self {
            timeout_secs,
            last_activity_ms: initial_activity_ms,
        }
    }

    pub fn report_activity(&mut self, now_ms: u64) {
        self.last_activity_ms = now_ms;
    }

    #[must_use]
    pub fn is_locked(&self, now_ms: u64) -> bool {
        if self.timeout_secs == 0 {
            return false;
        }

        // Handle potential underflow if now_ms is somehow before last_activity_ms (e.g., clock skew)
        // by saturating sub.
        let elapsed_ms = now_ms.saturating_sub(self.last_activity_ms);
        let timeout_ms = self.timeout_secs.saturating_mul(1000);

        elapsed_ms >= timeout_ms
    }
}

/// Reports activity to the lock daemon.
///
/// # Errors
/// Returns an error if the state mutex is poisoned.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn lock_report_activity(now_ms: u64, tracker: State<'_, Mutex<IdleTracker>>) -> Result<(), String> {
    let mut tracker = tracker.lock().map_err(|e| e.to_string())?;
    tracker.report_activity(now_ms);
    Ok(())
}

/// Gets the current lock status.
///
/// # Errors
/// Returns an error if the state mutex is poisoned.
#[tauri::command]
#[allow(clippy::needless_pass_by_value)]
pub fn lock_status(now_ms: u64, tracker: State<'_, Mutex<IdleTracker>>) -> Result<bool, String> {
    let tracker = tracker.lock().map_err(|e| e.to_string())?;
    Ok(tracker.is_locked(now_ms))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_timeout_boundary() {
        let tracker = IdleTracker::new(5, 1000);

        // At 1000ms, elapsed is 0, so not locked
        assert!(!tracker.is_locked(1000));

        // At 5999ms, elapsed is 4999ms, so not locked
        assert!(!tracker.is_locked(5999));

        // At 6000ms, elapsed is 5000ms, so locked
        assert!(tracker.is_locked(6000));

        // At 7000ms, elapsed is 6000ms, so locked
        assert!(tracker.is_locked(7000));
    }

    #[test]
    fn test_activity_resets() {
        let mut tracker = IdleTracker::new(5, 1000);

        assert!(!tracker.is_locked(5999));

        // Report activity at 5000ms
        tracker.report_activity(5000);

        // At 6000ms, elapsed is 1000ms, so not locked
        assert!(!tracker.is_locked(6000));

        // At 9999ms, elapsed is 4999ms, so not locked
        assert!(!tracker.is_locked(9999));

        // At 10000ms, elapsed is 5000ms, so locked
        assert!(tracker.is_locked(10000));
    }

    #[test]
    fn test_zero_timeout_never_locks() {
        let tracker = IdleTracker::new(0, 1000);

        assert!(!tracker.is_locked(1000));
        assert!(!tracker.is_locked(6000));
        assert!(!tracker.is_locked(1_000_000));
    }

    #[test]
    fn test_clock_skew_underflow() {
        let tracker = IdleTracker::new(5, 5000);

        // If now_ms is before last_activity_ms, elapsed is 0, so not locked
        assert!(!tracker.is_locked(1000));
    }
}
