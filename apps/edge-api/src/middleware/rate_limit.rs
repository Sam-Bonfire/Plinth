pub struct RateLimiter {
    max_requests: usize,
    window_secs: u64,
}

impl RateLimiter {
    #[must_use]
    pub fn new(max_requests: usize, window_secs: u64) -> Self {
        Self {
            max_requests,
            window_secs,
        }
    }

    /// Checks if a request is allowed for the given key using D1 for state storage.
    ///
    /// # Errors
    /// Returns false if rate limit is exceeded, or error if DB operations fail.
    pub async fn allow(&self, db: &worker::d1::D1Database, key: &str, now_secs: u64) -> worker::Result<bool> {
        let stmt = db.prepare("SELECT timestamps_json FROM rate_limits WHERE key = ?1").bind(&[key.into()])?;

        let mut timestamps: Vec<u64> = match stmt.first::<serde_json::Value>(None).await? {
            Some(row) => {
                let json_str = row.get("timestamps_json").and_then(|v: &serde_json::Value| v.as_str()).unwrap_or("[]");
                serde_json::from_str(json_str).unwrap_or_default()
            },
            None => Vec::new(),
        };

        // Prune old entries
        timestamps.retain(|&ts| ts + self.window_secs > now_secs);

        let allowed = if timestamps.len() < self.max_requests {
            timestamps.push(now_secs);
            true
        } else {
            false
        };

        if timestamps.is_empty() {
            let stmt = db.prepare("DELETE FROM rate_limits WHERE key = ?1").bind(&[key.into()])?;
            let _ = stmt.run().await?;
        } else {
            let new_json = serde_json::to_string(&timestamps).unwrap_or_else(|_| "[]".to_string());
            let stmt = db.prepare("INSERT OR REPLACE INTO rate_limits (key, timestamps_json) VALUES (?1, ?2)")
                .bind(&[key.into(), new_json.into()])?;
            let _ = stmt.run().await?;
        }

        Ok(allowed)
    }
}
