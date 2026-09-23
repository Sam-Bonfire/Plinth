use std::collections::HashMap;
use std::sync::Mutex;

pub struct RateLimiter {
    max_requests: usize,
    window_secs: u64,
    store: Mutex<HashMap<String, Vec<u64>>>,
}

impl RateLimiter {
    #[must_use]
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            max_requests,
            window_secs,
            store: Mutex::new(HashMap::new()),
        }
    }

    /// Checks if a request is allowed for the given key and updates the rate limit state.
    ///
    /// # Panics
    /// Panics if the internal mutex is poisoned.
    #[must_use]
    pub fn allow(&self, key: &str, now_secs: u64) -> bool {
        let mut store = self.store.lock().expect("mutex should not be poisoned");
        let timestamps = store.entry(key.to_string()).or_default();

        // Prune old entries using addition to prevent underflow
        timestamps.retain(|&ts| ts + self.window_secs > now_secs);

        let allowed = if timestamps.len() < self.max_requests {
            timestamps.push(now_secs);
            true
        } else {
            false
        };

        if timestamps.is_empty() {
            store.remove(key);
        }

        allowed
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_burst_blocked() {
        let limiter = RateLimiter::new(2, 10);
        assert!(limiter.allow("ip1", 100));
        assert!(limiter.allow("ip1", 100));
        assert!(!limiter.allow("ip1", 100));
    }

    #[test]
    fn test_window_reset() {
        let limiter = RateLimiter::new(2, 10);
        assert!(limiter.allow("ip1", 100));
        assert!(limiter.allow("ip1", 100));
        assert!(!limiter.allow("ip1", 105)); // still in window

        // Window resets at 111 (100 + 10 = 110, 110 is not > 111, so 100 is dropped)
        assert!(limiter.allow("ip1", 111));
    }

    #[test]
    fn test_per_key_isolation() {
        let limiter = RateLimiter::new(1, 10);
        assert!(limiter.allow("ip1", 100));
        assert!(!limiter.allow("ip1", 100));

        assert!(limiter.allow("ip2", 100)); // different key, should be allowed
    }

    #[test]
    fn test_no_clock_dependency() {
        let limiter = RateLimiter::new(2, 10);
        assert!(limiter.allow("ip1", 0)); // testing 0
        assert!(limiter.allow("ip1", 1));
        assert!(!limiter.allow("ip1", 2));
        assert!(limiter.allow("ip1", 10)); // 0 + 10 = 10, not > 10, so 0 drops
    }
}
