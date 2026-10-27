use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::time::sleep;
use tokio_util::sync::CancellationToken;

use crate::printing::spooler::Spooler;
use crate::printing::tcp_dispatcher::TcpDispatcher;

#[allow(clippy::cast_possible_truncation)]
pub async fn start_print_daemon(
    spooler: Arc<Mutex<Spooler>>,
    dispatcher: Arc<TcpDispatcher>,
    shutdown: CancellationToken,
) {
    loop {
        if shutdown.is_cancelled() {
            break;
        }

        let now_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_or(0, |d| (d.as_millis() & 0xFFFF_FFFF_FFFF_FFFF) as u64);

        let job_opt = {
            if let Ok(mut locked) = spooler.lock() {
                locked.dequeue_ready(now_ms)
            } else {
                None
            }
        };

        if let Some(job) = job_opt {
            let dispatch_result = dispatcher.dispatch(&job.target_address, &job.payload).await;

            if let Err(err) = dispatch_result {
                if let Ok(mut locked) = spooler.lock() {
                    locked.mark_failed(job, err.to_string(), now_ms);
                }
            }
        } else {
            sleep(Duration::from_millis(500)).await;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;
    use tokio::io::AsyncReadExt;

    #[tokio::test]
    #[allow(clippy::cast_possible_truncation)]
    async fn test_daemon_dispatches_and_removes_job() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let spooler = Arc::new(Mutex::new(Spooler::new()));
        let dispatcher = Arc::new(TcpDispatcher::new(
            Duration::from_secs(1),
            Duration::from_secs(1),
            1,
            Duration::from_millis(10),
        ));
        let token = CancellationToken::new();

        {
            let mut sp = spooler.lock().unwrap();
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_millis() as u64;
            sp.enqueue("j1".to_string(), addr.to_string(), b"hello".to_vec(), now);
            assert_eq!(sp.pending_count(), 1);
        }

        let daemon_handle = tokio::spawn(start_print_daemon(
            Arc::clone(&spooler),
            Arc::clone(&dispatcher),
            token.clone(),
        ));

        let mut buf = [0u8; 5];
        let (mut socket, _) = listener.accept().await.unwrap();
        socket.read_exact(&mut buf).await.unwrap();
        assert_eq!(&buf, b"hello");

        // Wait a bit for daemon to remove it from queue
        tokio::time::sleep(Duration::from_millis(100)).await;

        {
            let sp = spooler.lock().unwrap();
            assert_eq!(sp.pending_count(), 0);
            assert_eq!(sp.dead_letter_count(), 0);
        }

        token.cancel();
        daemon_handle.await.unwrap();
    }
}
