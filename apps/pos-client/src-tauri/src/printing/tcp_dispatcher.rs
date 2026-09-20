use std::time::Duration;
use thiserror::Error;
use tokio::io::AsyncWriteExt;
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

        timeout(self.write_timeout, stream.write_all(payload))
            .await
            .map_err(|_| Error::WriteTimeout)?
            .map_err(Error::Io)?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::TcpListener;
    use tokio::io::AsyncReadExt;

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
                assert!(matches!(e, Error::MaxRetriesExceeded(_)), "Expected MaxRetriesExceeded error, got {e:?}");
            }
            _ => panic!("Expected Error"),
        }
    }

    #[tokio::test]
    async fn test_dispatch_write_timeout() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        let dispatcher = TcpDispatcher::new(
            Duration::from_secs(1),
            Duration::from_millis(10), // Short write timeout
            1,
            Duration::from_millis(10),
        );

        let payload = vec![0u8; 1024 * 1024 * 10]; // 10MB payload

        let server_task = tokio::spawn(async move {
            let (socket, _) = listener.accept().await.unwrap();
            // Accept the connection but do not read the data
            // Keep the socket alive long enough for the write timeout to trigger
            tokio::time::sleep(Duration::from_millis(100)).await;
            // Drop it to avoid warning
            drop(socket);
        });

        let result = dispatcher.dispatch(&addr.to_string(), &payload).await;

        match result {
            Err(e) => {
                assert!(matches!(e, Error::MaxRetriesExceeded(_)), "Expected MaxRetriesExceeded error, got {e:?}");
            }
            _ => panic!("Expected Error"),
        }
        server_task.await.unwrap();
    }
}
