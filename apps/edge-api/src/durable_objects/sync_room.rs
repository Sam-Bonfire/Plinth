use chrono::Utc;
use core_domain::ids::StaffMemberId;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::cell::RefCell;
use std::collections::HashMap;
use std::time::Duration;
use sync_protocol::{
    clock::ClientNodeId,
    framing::SyncFrame,
    mutation::{EntityType, MutationRecord},
};
use uuid::Uuid;
use worker::{
    durable_object, wasm_bindgen::JsValue, DurableObject, Env, Request, Response, Result, State,
    WebSocket, WebSocketPair, WebsocketEvent,
};

/// Information about a connected terminal and its active operator
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TerminalPresenceInfo {
    pub client_node_id: ClientNodeId,
    pub staff_id: StaffMemberId,
}

/// Parses and validates WebSocket handshake query parameters.
///
/// # Errors
/// Returns a message if either parameter is missing or the staff ID is not a UUID.
pub fn parse_handshake_params<S: std::hash::BuildHasher>(
    query_pairs: &HashMap<String, String, S>,
) -> std::result::Result<(ClientNodeId, StaffMemberId), &'static str> {
    let Some(client_node_id_str) = query_pairs.get("client_node_id").cloned() else {
        return Err("Missing client_node_id query parameter");
    };
    let Some(staff_id_str) = query_pairs.get("staff_id").cloned() else {
        return Err("Missing staff_id query parameter");
    };
    let Ok(staff_uuid) = Uuid::parse_str(&staff_id_str) else {
        return Err("Invalid staff_id UUID");
    };
    Ok((ClientNodeId(client_node_id_str), StaffMemberId::from(staff_uuid)))
}

/// Durable Object managing real-time WebSocket pub-sub and mutation synchronization for a restaurant location
#[durable_object]
pub struct HearthRoom {
    state: State,
    env: Env,
    sessions: RefCell<HashMap<Uuid, (WebSocket, ClientNodeId, StaffMemberId)>>,
    presence: RefCell<HashMap<ClientNodeId, TerminalPresenceInfo>>,
    unflushed: RefCell<Vec<MutationRecord>>,
}

pub type LocationSyncRoom = HearthRoom;

impl DurableObject for HearthRoom {
    fn new(state: State, env: Env) -> Self {
        Self {
            state,
            env,
            sessions: RefCell::new(HashMap::new()),
            presence: RefCell::new(HashMap::new()),
            unflushed: RefCell::new(Vec::new()),
        }
    }

    async fn fetch(&self, req: Request) -> Result<Response> {
        let url = req.url()?;
        let query_pairs: HashMap<String, String> = url.query_pairs().into_owned().collect();

        let (client_node_id, staff_id) = match parse_handshake_params(&query_pairs) {
            Ok(v) => v,
            Err(msg) => return Response::error(msg, 400),
        };

        let pair = WebSocketPair::new()?;
        let server = pair.server;
        server.accept()?;

        let session_id = Uuid::now_v7();
        self.sessions.borrow_mut().insert(
            session_id,
            (server.clone(), client_node_id.clone(), staff_id),
        );
        self.presence.borrow_mut().insert(
            client_node_id.clone(),
            TerminalPresenceInfo {
                client_node_id: client_node_id.clone(),
                staff_id,
            },
        );

        self.broadcast_presence();

        let mut event_stream = server.events()?;

        while let Some(event) = event_stream.next().await {
            match event {
                Ok(WebsocketEvent::Message(msg)) => {
                    if let Some(bytes) = msg.bytes() {
                        if let Ok(frame) = bincode::deserialize::<SyncFrame>(&bytes) {
                            self.handle_frame(session_id, frame).await?;
                        }
                    } else if let Some(text) = msg.text() {
                        if let Ok(frame) = serde_json::from_str::<SyncFrame>(&text) {
                            self.handle_frame(session_id, frame).await?;
                        }
                    }
                }
                Ok(WebsocketEvent::Close(_)) => {
                    self.remove_session(&session_id);
                    break;
                }
                _ => {}
            }
        }

        Response::from_websocket(pair.client)
    }

    async fn alarm(&self) -> Result<Response> {
        if self.unflushed.borrow().is_empty() {
            return Response::empty();
        }

        let db = match self.env.d1("CELLAR_DB") {
            Ok(db) => db,
            Err(e) => return Response::error(format!("Database error in alarm: {e}"), 500),
        };

        let mutations = std::mem::take(&mut *self.unflushed.borrow_mut());
        let mut statements = Vec::new();

        for mutation in mutations {
            let record_sql = "INSERT INTO mutation_records (id, tenant_id, location_id, node_id, sequence, mutation_type, payload_json, signature, applied_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
            let record_params: Vec<JsValue> = vec![
                mutation.mutation_id.to_string().into(),
                "unknown_tenant".into(),
                "unknown_location".into(),
                "server".into(),
                mutation.logical_clock.into(),
                format!("{:?}", mutation.entity_type).into(),
                mutation.payload_json.clone().into(),
                mutation.checksum.clone().into(),
                mutation.timestamp.to_rfc3339().into(),
            ];

            let record_stmt = db.prepare(record_sql).bind(&record_params)?;
            statements.push(record_stmt);

            match mutation.entity_type {
                EntityType::Order => {
                    let stmt = db
                        .prepare("UPDATE orders SET updated_at = ? WHERE id = ?")
                        .bind(&[
                            mutation.timestamp.to_rfc3339().into(),
                            mutation.entity_id.to_string().into(),
                        ])?;
                    statements.push(stmt);
                }
                EntityType::MenuItem => {
                    let stmt = db
                        .prepare("UPDATE menu_items SET description = ? WHERE id = ?")
                        .bind(&[
                            mutation.payload_json.into(),
                            mutation.entity_id.to_string().into(),
                        ])?;
                    statements.push(stmt);
                }
                EntityType::StockItem => {
                    let stmt = db
                        .prepare("UPDATE stock_items SET name = ? WHERE id = ?")
                        .bind(&[
                            mutation.payload_json.into(),
                            mutation.entity_id.to_string().into(),
                        ])?;
                    statements.push(stmt);
                }
                _ => {}
            }
        }

        if !statements.is_empty() {
            let _ = db.batch(statements).await?;
        }

        Response::empty()
    }
}

impl HearthRoom {
    #[allow(clippy::too_many_lines)]
    async fn handle_frame(&self, session_id: Uuid, frame: SyncFrame) -> Result<()> {
        match frame {
            SyncFrame::PushMutations {
                batch_id,
                sender_node_id,
                mutations,
                is_urgent,
            } => {
                let mut valid_mutations = Vec::new();
                for mutation in mutations {
                    if mutation.verify_checksum() {
                        valid_mutations.push(mutation.clone());
                        self.unflushed.borrow_mut().push(mutation);
                    }
                }

                if !valid_mutations.is_empty() {
                    let broadcast_frame = SyncFrame::PushMutations {
                        batch_id,
                        sender_node_id: sender_node_id.clone(),
                        mutations: valid_mutations,
                        is_urgent,
                    };
                    let broadcast_bytes = bincode::serialize(&broadcast_frame).unwrap_or_default();

                    for (id, (ws, _, _)) in self.sessions.borrow().iter() {
                        if *id != session_id {
                            let _ = ws.send_with_bytes(&broadcast_bytes);
                        }
                    }

                    let current_alarm = self.state.storage().get_alarm().await?;
                    if current_alarm.is_none() {
                        self.state
                            .storage()
                            .set_alarm(Duration::from_secs(5))
                            .await?;
                    }
                }
            }
            SyncFrame::HeartbeatPing { client_time_ms } => {
                if let Some((ws, _, _)) = self.sessions.borrow().get(&session_id) {
                    let pong = SyncFrame::HeartbeatPong {
                        client_time_ms,
                        server_time_ms: Utc::now().timestamp_millis(),
                    };
                    let bytes = bincode::serialize(&pong).unwrap_or_default();
                    let _ = ws.send_with_bytes(&bytes);
                }
            }
            _ => {}
        }
        Ok(())
    }

    fn broadcast_presence(&self) {
        let ping = SyncFrame::HeartbeatPing {
            client_time_ms: Utc::now().timestamp_millis(),
        };
        let bytes = bincode::serialize(&ping).unwrap_or_default();

        for (ws, _, _) in self.sessions.borrow().values() {
            let _ = ws.send_with_bytes(&bytes);
        }
    }

    fn remove_session(&self, session_id: &Uuid) {
        if let Some((_, client_node_id, _)) = self.sessions.borrow_mut().remove(session_id) {
            self.presence.borrow_mut().remove(&client_node_id);
            self.broadcast_presence();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use sync_protocol::mutation::OperationType;

    #[test]
    fn test_handshake_params_accept_valid_pair() {
        let staff_uuid = Uuid::now_v7().to_string();
        let pairs: HashMap<String, String> = HashMap::from([
            ("client_node_id".to_string(), "terminal-pos-01".to_string()),
            ("staff_id".to_string(), staff_uuid.clone()),
        ]);
        let (node, staff) = parse_handshake_params(&pairs).expect("valid handshake");
        assert_eq!(node, ClientNodeId("terminal-pos-01".to_string()));
        assert_eq!(staff, StaffMemberId::from(Uuid::parse_str(&staff_uuid).unwrap()));
    }

    #[test]
    fn test_handshake_params_reject_missing_or_bad_values() {
        let empty: HashMap<String, String> = HashMap::new();
        assert_eq!(
            parse_handshake_params(&empty),
            Err("Missing client_node_id query parameter")
        );
        let missing_staff: HashMap<String, String> =
            HashMap::from([("client_node_id".to_string(), "t-1".to_string())]);
        assert_eq!(
            parse_handshake_params(&missing_staff),
            Err("Missing staff_id query parameter")
        );
        let bad_uuid: HashMap<String, String> = HashMap::from([
            ("client_node_id".to_string(), "t-1".to_string()),
            ("staff_id".to_string(), "not-a-uuid".to_string()),
        ]);
        assert_eq!(parse_handshake_params(&bad_uuid), Err("Invalid staff_id UUID"));
    }

    #[test]
    fn test_terminal_presence_tracker() {        let staff_id = StaffMemberId::new();
        let client_node_id = ClientNodeId("terminal-pos-01".to_string());

        let mut presence: HashMap<ClientNodeId, TerminalPresenceInfo> = HashMap::new();

        let info = TerminalPresenceInfo {
            client_node_id: client_node_id.clone(),
            staff_id,
        };

        presence.insert(client_node_id.clone(), info.clone());
        assert_eq!(presence.len(), 1);
        assert_eq!(presence.get(&client_node_id).unwrap(), &info);

        presence.remove(&client_node_id);
        assert_eq!(presence.len(), 0);
    }

    #[test]
    fn test_mutation_buffer_and_checksum_verification() {
        let mut mutation = MutationRecord {
            mutation_id: Uuid::now_v7(),
            session_id: Uuid::now_v7(),
            entity_id: Uuid::now_v7(),
            entity_type: EntityType::Order,
            operation: OperationType::Create,
            payload_json: "{\"total_minor\": 15000}".to_string(),
            timestamp: Utc::now(),
            is_urgent: false,
            logical_clock: 1,
            checksum: String::new(),
        };
        mutation.checksum = mutation.compute_checksum();

        let mut unflushed: Vec<MutationRecord> = Vec::new();

        if mutation.verify_checksum() {
            unflushed.push(mutation.clone());
        }

        assert_eq!(unflushed.len(), 1);

        let mut tampered = mutation.clone();
        tampered.payload_json = "{\"total_minor\": 99999}".to_string();

        if tampered.verify_checksum() {
            unflushed.push(tampered);
        }

        // Tampered payload fails checksum and is not added
        assert_eq!(unflushed.len(), 1);

        let to_flush = std::mem::take(&mut unflushed);
        assert_eq!(to_flush.len(), 1);
        assert_eq!(unflushed.len(), 0);
    }
}
