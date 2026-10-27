CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    timestamps_json TEXT NOT NULL
);
