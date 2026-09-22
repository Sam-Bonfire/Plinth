#![deny(unsafe_code)]

use futures_util::{SinkExt, StreamExt};
use std::time::Duration;
use thiserror::Error;
use tokio::sync::{mpsc, watch};
use tokio::time::sleep;
use tokio_util::sync::CancellationToken;
use url::Url;

#[derive(Debug, Error)]
pub enum WsClientError {
    #[error("URL parsing error: {0}")]
    UrlError(#[from] url::ParseError),
    #[error("WebSocket connection error: {0}")]
    ConnectionError(#[from] tokio_tungstenite::tungstenite::Error),
    #[error("Message delivery error")]
    DeliveryError,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum WsClientState {
    Disconnected,
    Connecting,
    Connected,
}

#[derive(Debug, Clone)]
pub struct WsClientConfig {
    pub base_url: String, // e.g., "ws://localhost:8787/ws/sync"
    pub tenant_id: String,
    pub location_id: String,
    pub client_node_id: String,
    pub staff_id: String,
}

impl WsClientConfig {
    /// Builds the full WebSocket URL including required query parameters.
    ///
    /// # Errors
    /// Returns a `WsClientError::UrlError` if the base URL is invalid.
    pub fn build_url(&self) -> Result<Url, WsClientError> {
        let mut url = Url::parse(&self.base_url)?;
        url.query_pairs_mut()
            .append_pair("tenant_id", &self.tenant_id)
            .append_pair("location_id", &self.location_id)
            .append_pair("client_node_id", &self.client_node_id)
            .append_pair("staff_id", &self.staff_id);
        Ok(url)
    }
}

pub struct WsClient {
    #[allow(dead_code)]
    config: WsClientConfig,
    state_rx: watch::Receiver<WsClientState>,
    outbound_tx: mpsc::Sender<String>,
}

impl WsClient {
    #[must_use]
    pub fn new(
        config: WsClientConfig,
        inbound_tx: mpsc::Sender<String>,
        shutdown_token: CancellationToken,
    ) -> (Self, watch::Receiver<WsClientState>) {
        let (state_tx, state_rx) = watch::channel(WsClientState::Disconnected);
        let client_state_rx = state_rx.clone();

        let (outbound_tx, outbound_rx) = mpsc::channel(100);

        let client_config = config.clone();

        tokio::spawn(async move {
            Self::connection_loop(client_config, state_tx, inbound_tx, outbound_rx, shutdown_token).await;
        });

        (
            Self {
                config,
                state_rx: client_state_rx,
                outbound_tx,
            },
            state_rx,
        )
    }

    #[must_use]
    pub fn state(&self) -> WsClientState {
        self.state_rx.borrow().clone()
    }

    /// Enqueues a message to be sent to the WebSocket server.
    ///
    /// # Errors
    /// Returns `WsClientError::DeliveryError` if the message cannot be enqueued (e.g., if the client has shut down).
    pub async fn send(&self, message: String) -> Result<(), WsClientError> {
        self.outbound_tx.send(message).await.map_err(|_| WsClientError::DeliveryError)
    }

    async fn connection_loop(
        config: WsClientConfig,
        state_tx: watch::Sender<WsClientState>,
        inbound_tx: mpsc::Sender<String>,
        mut outbound_rx: mpsc::Receiver<String>,
        shutdown_token: CancellationToken,
    ) {
        let url = match config.build_url() {
            Ok(url) => url.to_string(),
            Err(e) => {
                eprintln!("Failed to build WebSocket URL: {e}");
                return;
            }
        };

        let mut backoff = Duration::from_millis(500);
        let max_backoff = Duration::from_secs(30);

        loop {
            if shutdown_token.is_cancelled() {
                break;
            }

            let _ = state_tx.send(WsClientState::Connecting);

            match tokio_tungstenite::connect_async(&url).await {
                Ok((mut ws_stream, _)) => {
                    let _ = state_tx.send(WsClientState::Connected);
                    backoff = Duration::from_millis(500); // Reset backoff on success

                    loop {
                        tokio::select! {
                            msg = ws_stream.next() => {
                                match msg {
                                    Some(Ok(msg)) => {
                                        if let tokio_tungstenite::tungstenite::Message::Text(text) = msg {
                                            if inbound_tx.send(text.to_string()).await.is_err() {
                                                eprintln!("Failed to send received message to channel");
                                            }
                                        } else if let tokio_tungstenite::tungstenite::Message::Binary(bytes) = msg {
                                            if let Ok(text) = String::from_utf8(bytes.to_vec()) {
                                                if inbound_tx.send(text).await.is_err() {
                                                    eprintln!("Failed to send received message to channel");
                                                }
                                            } else {
                                                eprintln!("Received non-UTF8 binary frame");
                                            }
                                        }
                                    }
                                    Some(Err(e)) => {
                                        eprintln!("WebSocket error: {e}");
                                        break; // Disconnect and reconnect
                                    }
                                    None => {
                                        eprintln!("WebSocket stream closed");
                                        break; // Disconnect and reconnect
                                    }
                                }
                            }
                            Some(outbound_msg) = outbound_rx.recv() => {
                                if let Err(e) = ws_stream.send(tokio_tungstenite::tungstenite::Message::Text(outbound_msg.into())).await {
                                    eprintln!("Failed to send WebSocket message: {e}");
                                    break;
                                }
                            }
                            () = shutdown_token.cancelled() => {
                                let _ = ws_stream.close(None).await;
                                return;
                            }
                        }
                    }
                }
                Err(e) => {
                    eprintln!("WebSocket connection failed: {e}");
                }
            }

            let _ = state_tx.send(WsClientState::Disconnected);

            // Wait for backoff or shutdown
            tokio::select! {
                () = sleep(backoff) => {}
                () = shutdown_token.cancelled() => { break; }
            }

            backoff = std::cmp::min(backoff * 2, max_backoff);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use futures_util::SinkExt;
    use tokio::net::TcpListener;
    use tokio_tungstenite::accept_async;

    async fn start_echo_server() -> String {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();

        tokio::spawn(async move {
            if let Ok((stream, _)) = listener.accept().await {
                if let Ok(mut ws_stream) = accept_async(stream).await {
                    while let Some(msg) = ws_stream.next().await {
                        if let Ok(msg) = msg {
                            let _ = ws_stream.send(msg).await;
                        }
                    }
                }
            }
        });

        format!("ws://{addr}")
    }

    #[tokio::test]
    async fn test_ws_client_backoff_progression() {
        // Bind then drop a listener to reserve a port that is guaranteed
        // to refuse connections (port 0 may hang instead of refusing).
        let refused_port = {
            let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
            listener.local_addr().unwrap().port()
        };
        let config = WsClientConfig {
            base_url: format!("ws://127.0.0.1:{refused_port}"),
            tenant_id: "t1".into(),
            location_id: "l1".into(),
            client_node_id: "n1".into(),
            staff_id: "s1".into(),
        };

        let (msg_tx, _msg_rx) = mpsc::channel(10);
        let cancel_token = CancellationToken::new();

        let (_client, mut state_rx) = WsClient::new(config, msg_tx, cancel_token.clone());

        // We expect it to oscillate between Connecting and Disconnected
        let _ = state_rx.wait_for(|s| *s == WsClientState::Connecting).await;
        let _ = state_rx.wait_for(|s| *s == WsClientState::Disconnected).await;
        let _ = state_rx.wait_for(|s| *s == WsClientState::Connecting).await;

        cancel_token.cancel();
    }

    #[tokio::test]
    async fn test_ws_client_connect_and_deliver() {
        let server_url = start_echo_server().await;

        let config = WsClientConfig {
            base_url: server_url,
            tenant_id: "t1".into(),
            location_id: "l1".into(),
            client_node_id: "n1".into(),
            staff_id: "s1".into(),
        };

        let (msg_tx, _msg_rx) = mpsc::channel(10);
        let cancel_token = CancellationToken::new();

        let (client, mut state_rx) = WsClient::new(config, msg_tx, cancel_token.clone());

        // Wait for connected state
        let _ = state_rx.wait_for(|s| *s == WsClientState::Connected).await;
        assert_eq!(client.state(), WsClientState::Connected);

        cancel_token.cancel();
    }

    #[tokio::test]
    async fn test_ws_client_frame_round_trip() {
        let server_url = start_echo_server().await;

        let config = WsClientConfig {
            base_url: server_url,
            tenant_id: "t1".into(),
            location_id: "l1".into(),
            client_node_id: "n1".into(),
            staff_id: "s1".into(),
        };

        let (msg_tx, mut msg_rx) = mpsc::channel(10);
        let cancel_token = CancellationToken::new();

        let (client, mut state_rx) = WsClient::new(config, msg_tx, cancel_token.clone());

        let _ = state_rx.wait_for(|s| *s == WsClientState::Connected).await;

        let test_message = r#"{"HeartbeatPing":{"client_time_ms":12345}}"#.to_string();
        client.send(test_message.clone()).await.unwrap();

        let received = msg_rx.recv().await.unwrap();
        assert_eq!(received, test_message);

        cancel_token.cancel();
    }
}
