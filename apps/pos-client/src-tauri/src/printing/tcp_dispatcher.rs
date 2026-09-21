use std::time::Duration;
use thiserror::Error;
use tokio::io::{AsyncWrite, AsyncWriteExt};
use tokio::net::TcpStream;
use tokio::time::timeout;

#[derive(Debug, Error)]
pub enum Error {
    #[error("connection timeout")]
    ConnectTimeout,
    #[error("write timeout")]
    WriteTimeout,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("max retries exceeded, last error: {0}")]
    MaxRetriesExceeded(Box<Error>),
}

pub struct TcpDispatcher {
    pub connect_timeout: Duration,
    pub write_timeout: Duration,
    pub max_retries: u32,
    pub base_backoff: Duration,
}

impl TcpDispatcher {
    #[must_use]
    pub fn new(
        connect_timeout: Duration,
        write_timeout: Duration,
        max_retries: u32,
        base_backoff: Duration,
    ) -> Self {
        Self {
            connect_timeout,
            write_timeout,
            max_retries,
            base_backoff,
        }
    }

    /// Dispatches the payload to the given address.
    ///
    /// # Errors
    ///
    /// Returns `Error::MaxRetriesExceeded` if the payload could not be delivered after the configured
    /// number of retries. Can also return `Error::ConnectTimeout`, `Error::WriteTimeout` or `Error::Io`
    /// if the last attempt fails.
    pub async fn dispatch(&self, address: &str, payload: &[u8]) -> Result<(), Error> {
        let mut retries = 0;
        let mut current_backoff = self.base_backoff;

        loop {
            match self.try_dispatch(address, payload).await {
                Ok(()) => return Ok(()),
                Err(e) => {
                    if retries >= self.max_retries {
                        return Err(Error::MaxRetriesExceeded(Box::new(e)));
                    }
                    retries += 1;
                    tokio::time::sleep(current_backoff).await;
                    current_backoff *= 2;
                }
            }
        }
    }

    async fn try_dispatch(&self, address: &str, payload: &[u8]) -> Result<(), Error> {
        let mut stream = timeout(self.connect_timeout, TcpStream::connect(address))
            .await
            .map_err(|_| Error::ConnectTimeout)?
            .map_err(Error::Io)?;

        write_with_timeout(&mut stream, payload, self.write_timeout).await?;

        Ok(())
    }
}

/// Writes a payload with a deadline. Split out so the timeout path is
/// testable without depending on loopback timing.
async fn write_with_timeout<S: AsyncWrite + Unpin>(
    stream: &mut S,
    payload: &[u8],
    write_timeout: Duration,
) -> Result<(), Error> {
    timeout(write_timeout, stream.write_all(payload))
        .await
        .map_err(|_| Error::WriteTimeout)?
        .map_err(Error::Io)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::AsyncReadExt;
    use tokio::net::TcpListener;

    #[tokio::test]
    async fn test_dispatch_success() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let dispatcher = TcpDispatcher::new(
            Duration::from_secs(1),
            Duration::from_secs(1),
            3,
            Duration::from_millis(10),
        );

        let payload = b"hello";

        let server_task = tokio::spawn(async move {
            let (mut socket, _) = listener.accept().await.unwrap();
            let mut buf = [0; 5];
            socket.read_exact(&mut buf).await.unwrap();
            assert_eq!(&buf, payload);
        });

        let result = dispatcher.dispatch(&addr.to_string(), payload).await;
        assert!(result.is_ok());
        server_task.await.unwrap();
    }

    #[tokio::test]
    async fn test_dispatch_retry_count() {
        // Find a free port but don't bind to it to force connection failures
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        drop(listener); // Close so it refuses connections

        let dispatcher = TcpDispatcher::new(
            Duration::from_millis(100),
            Duration::from_millis(100),
            2,
            Duration::from_millis(10),
        );

        let payload = b"hello";
        let result = dispatcher.dispatch(&addr.to_string(), payload).await;

        match result {
            Err(e) => {
                assert!(
                    matches!(e, Error::MaxRetriesExceeded(_)),
                    "Expected MaxRetriesExceeded error, got {e:?}"
                );
            }
            _ => panic!("Expected Error"),
        }
    }

    #[tokio::test]
    async fn test_write_timeout_is_deterministic() {
        // 64-byte buffer that nobody drains: a 4 KiB write cannot finish.
        let (mut writer, _reader) = tokio::io::duplex(64);
        let payload = vec![0u8; 4096];
        let err = write_with_timeout(&mut writer, &payload, Duration::from_secs(5))
            .await
            .expect_err("64-byte undrained buffer must time out");
        assert!(matches!(err, Error::WriteTimeout), "got {err:?}");
    }

    #[tokio::test]
    async fn test_write_success_small_payload() {
        let (mut writer, mut reader) = tokio::io::duplex(4096);
        let payload = b"hello";
        let (result, _) = tokio::join!(
            write_with_timeout(&mut writer, payload, Duration::from_secs(5)),
            async {
                let mut buf = [0u8; 5];
                tokio::io::AsyncReadExt::read_exact(&mut reader, &mut buf).await.unwrap();
                buf
            }
        );
        assert!(result.is_ok());
    }
}
