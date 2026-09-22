import re

with open("apps/pos-client/src-tauri/src/sync_daemon/ws_client.rs", "r") as f:
    content = f.read()

# Extract just the top part of the file before the tests module
main_code = content.split("#[cfg(test)]\nmod tests {")[0]

tests_module = """#[cfg(test)]
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
        let config = WsClientConfig {
            base_url: "ws://127.0.0.1:0".into(), // Unreachable server
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
"""

with open("apps/pos-client/src-tauri/src/sync_daemon/ws_client.rs", "w") as f:
    f.write(main_code + tests_module)
