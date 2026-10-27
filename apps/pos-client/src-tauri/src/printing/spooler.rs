#![deny(unsafe_code)]
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct PrintJob {
    pub id: String,
    pub target_address: String,
    pub payload: Vec<u8>,
    pub attempts: u32,
    pub next_retry_at_ms: u64,
    pub last_error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueState {
    pub queued_count: usize,
    pub failed_count: usize,
    pub last_error: Option<String>,
}

#[derive(Debug, Default)]
pub struct Spooler {
    queue: Vec<PrintJob>,
    dead_letters: Vec<PrintJob>,
    last_error: Option<String>,
}

impl Spooler {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    pub fn enqueue(&mut self, id: String, target_address: String, payload: Vec<u8>, now_ms: u64) {
        self.queue.push(PrintJob {
            id,
            target_address,
            payload,
            attempts: 0,
            next_retry_at_ms: now_ms,
            last_error: None,
        });
    }

    pub fn dequeue_ready(&mut self, now_ms: u64) -> Option<PrintJob> {
        let index = self.queue.iter().position(|job| job.next_retry_at_ms <= now_ms)?;
        Some(self.queue.remove(index))
    }

    pub fn mark_failed(&mut self, mut job: PrintJob, error: String, now_ms: u64) {
        job.attempts += 1;
        job.last_error = Some(error.clone());
        self.last_error = Some(error);

        if job.attempts >= 5 {
            self.dead_letters.push(job);
        } else {
            // Exponential backoff base 1000ms: 1000 * 2^(attempts - 1)
            let backoff = 1000 * 2u64.pow(job.attempts - 1);
            job.next_retry_at_ms = now_ms + backoff;
            self.queue.push(job);
        }
    }

    /// Retries a job that is currently in the dead-letter queue.
    ///
    /// # Errors
    /// Returns an error if the specified job ID is not found in the dead-letter queue.
    pub fn retry_job(&mut self, job_id: &str, now_ms: u64) -> Result<(), String> {
        if let Some(index) = self.dead_letters.iter().position(|j| j.id == job_id) {
            let mut job = self.dead_letters.remove(index);
            job.attempts = 0;
            job.next_retry_at_ms = now_ms;
            job.last_error = None;
            self.queue.push(job);
            Ok(())
        } else {
            Err(format!("Job {job_id} not found in dead letters"))
        }
    }

    #[must_use]
    pub fn pending_count(&self) -> usize {
        self.queue.len()
    }

    #[must_use]
    pub fn dead_letter_count(&self) -> usize {
        self.dead_letters.len()
    }

    #[must_use]
    pub fn get_queue_state(&self) -> QueueState {
        QueueState {
            queued_count: self.queue.len(),
            failed_count: self.dead_letters.len(),
            last_error: self.last_error.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_retry_timing() {
        let mut spooler = Spooler::new();
        let start_time = 100_000;
        spooler.enqueue("job1".to_string(), "127.0.0.1:9100".to_string(), vec![1, 2, 3], start_time);

        let job = spooler.dequeue_ready(start_time).unwrap();
        spooler.mark_failed(job.clone(), "timeout".to_string(), start_time);

        // After 1 fail, attempt is 1. Backoff is 1000 * 2^0 = 1000ms.
        // next_retry = start_time + 1000.
        assert_eq!(spooler.queue[0].attempts, 1);
        assert_eq!(spooler.queue[0].next_retry_at_ms, start_time + 1000);
        assert_eq!(spooler.queue[0].last_error.as_deref(), Some("timeout"));
        assert_eq!(spooler.last_error.as_deref(), Some("timeout"));

        // Not ready yet
        assert!(spooler.dequeue_ready(start_time + 500).is_none());

        // Ready now
        let job_retry = spooler.dequeue_ready(start_time + 1000).unwrap();

        let second_fail_time = start_time + 1200;
        spooler.mark_failed(job_retry, "timeout2".to_string(), second_fail_time);

        // After 2 fails, attempt is 2. Backoff is 1000 * 2^1 = 2000ms.
        // next_retry = second_fail_time + 2000.
        assert_eq!(spooler.queue[0].attempts, 2);
        assert_eq!(spooler.queue[0].next_retry_at_ms, second_fail_time + 2000);
        assert_eq!(spooler.queue[0].last_error.as_deref(), Some("timeout2"));
    }

    #[test]
    fn test_max_attempts() {
        let mut spooler = Spooler::new();
        let mut now = 100_000;
        spooler.enqueue("job1".to_string(), "127.0.0.1".to_string(), vec![1, 2, 3], now);

        for _ in 0..4 {
            let job = spooler.dequeue_ready(now).unwrap();
            spooler.mark_failed(job, "err".to_string(), now);
            now += 10000; // Fast forward
        }

        assert_eq!(spooler.pending_count(), 1);
        assert_eq!(spooler.dead_letter_count(), 0);

        let job = spooler.dequeue_ready(now).unwrap();
        assert_eq!(job.attempts, 4);
        spooler.mark_failed(job, "final err".to_string(), now);

        assert_eq!(spooler.pending_count(), 0);
        assert_eq!(spooler.dead_letter_count(), 1);
        assert_eq!(spooler.dead_letters[0].attempts, 5);
        assert_eq!(spooler.dead_letters[0].last_error.as_deref(), Some("final err"));
    }

    #[test]
    fn test_fifo_order() {
        let mut spooler = Spooler::new();
        let now = 100_000;

        spooler.enqueue("job1".to_string(), "127.0.0.1".to_string(), vec![1], now);
        spooler.enqueue("job2".to_string(), "127.0.0.1".to_string(), vec![2], now);
        spooler.enqueue("job3".to_string(), "127.0.0.1".to_string(), vec![3], now + 5000); // In the future

        // Ready jobs should come out in FIFO
        let j1 = spooler.dequeue_ready(now).unwrap();
        assert_eq!(j1.id, "job1");

        let j2 = spooler.dequeue_ready(now).unwrap();
        assert_eq!(j2.id, "job2");

        assert!(spooler.dequeue_ready(now).is_none());

        // Now job3 is ready
        let j3 = spooler.dequeue_ready(now + 5000).unwrap();
        assert_eq!(j3.id, "job3");
    }

    #[test]
    fn test_retry_job() {
        let mut spooler = Spooler::new();
        let mut now = 100_000;
        spooler.enqueue("job1".to_string(), "127.0.0.1".to_string(), vec![1], now);

        // Fail 5 times
        for _ in 0..5 {
            let job = spooler.dequeue_ready(now).unwrap();
            spooler.mark_failed(job, "err".to_string(), now);
            now += 10000;
        }

        assert_eq!(spooler.pending_count(), 0);
        assert_eq!(spooler.dead_letter_count(), 1);

        // Retry
        now += 10000;
        assert!(spooler.retry_job("job1", now).is_ok());

        assert_eq!(spooler.pending_count(), 1);
        assert_eq!(spooler.dead_letter_count(), 0);

        let job = spooler.dequeue_ready(now).unwrap();
        assert_eq!(job.id, "job1");
        assert_eq!(job.attempts, 0);
        assert_eq!(job.last_error, None);
    }
}
