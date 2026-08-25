use chrono::Utc;
use sync_protocol::{
    clock::VectorClock, clock::ClientNodeId, HeartbeatWatchdog,
    mutation::{MutationRecord, EntityType, OperationType},
    network::{ShiftSyncSeal, SyncSealError, WatchdogAction},
    security::{TerminalKeyRegistry, TerminalKeypair},
};
use uuid::Uuid;

#[test]
fn test_cryptographic_signing_and_verification() {
    let node_id = ClientNodeId(Uuid::now_v7().to_string());
    let keypair = TerminalKeypair::generate(node_id.clone());
    let mut registry = TerminalKeyRegistry::new();
    registry.register(node_id.clone(), *keypair.verifying_key());

    let mut mutation = MutationRecord {
        mutation_id: Uuid::now_v7(),
        session_id: Uuid::now_v7(),
        entity_id: Uuid::now_v7(),
        entity_type: EntityType::Order,
        operation: OperationType::Create,
        payload_json: "{}".to_string(),
        timestamp: Utc::now(),
        is_urgent: false,
        logical_clock: 1,
        checksum: String::new(),
    };
    mutation.checksum = mutation.compute_checksum();

    let signature = keypair.sign_mutation(&mutation);

    let result = registry.verify_signature(&node_id, &mutation.checksum, &signature);
    assert!(result.is_ok());
    assert!(result.unwrap());

    let forge_result = registry.verify_signature(&node_id, "invalid_checksum", &signature);
    assert!(forge_result.is_err());
}

#[test]
fn test_selective_signature_enforcement() {
    assert!(TerminalKeyRegistry::requires_signature(
        "OrderDiscountApplied"
    ));
    assert!(TerminalKeyRegistry::requires_signature("OrderVoided"));
    assert!(TerminalKeyRegistry::requires_signature("StoreShiftClosed"));
    assert!(TerminalKeyRegistry::requires_signature("RefundProcessed"));
    assert!(!TerminalKeyRegistry::requires_signature("ItemAdded"));
}

#[test]
fn test_heartbeat_watchdog_state_machine() {
    let mut watchdog = HeartbeatWatchdog::new();
    let now = Utc::now();

    // First tick should send ping
    assert_eq!(watchdog.tick(now), WatchdogAction::SendPing);

    // 1st missed ping
    let later = now + chrono::Duration::seconds(6);
    assert_eq!(watchdog.tick(later), WatchdogAction::SendPing);

    // 2nd missed ping
    let later2 = later + chrono::Duration::seconds(6);
    assert_eq!(watchdog.tick(later2), WatchdogAction::SendPing);

    // 3rd missed ping -> transition to offline mode
    let later3 = later2 + chrono::Duration::seconds(6);
    assert_eq!(watchdog.tick(later3), WatchdogAction::TriggerOfflineMode);

    // Receive pong resets missed pings
    let later4 = later3 + chrono::Duration::seconds(1);
    watchdog.receive_pong(later4);
    let later5 = later4 + chrono::Duration::seconds(6);
    assert_eq!(watchdog.tick(later5), WatchdogAction::SendPing);
}

#[test]
fn test_shift_sync_seal_rejection() {
    let entity_id = Uuid::now_v7();
    let seal = ShiftSyncSeal {
        shift_id: entity_id.to_string(),
        closed_at: Utc::now(),
        final_vector_clock: VectorClock::new(),
        closing_signature: "sig".to_string(),
        z_report_hash: "hash".to_string(),
    };
    let seals = vec![seal.clone()];

    let mutation = MutationRecord {
        mutation_id: Uuid::now_v7(),
        session_id: Uuid::now_v7(),
        entity_id,
        entity_type: EntityType::Custom("StoreShift".to_string()),
        operation: OperationType::Create,
        payload_json: "{}".to_string(),
        timestamp: Utc::now(),
        is_urgent: false,
        logical_clock: 1,
        checksum: String::new(),
    };

    let result = ShiftSyncSeal::validate_mutation_against_seal(&mutation, &seals);
    assert!(matches!(result, Err(SyncSealError::ShiftAlreadySealed)));

    let valid_mutation = MutationRecord {
        mutation_id: Uuid::now_v7(),
        session_id: Uuid::now_v7(),
        entity_id: Uuid::now_v7(),
        entity_type: EntityType::Custom("StoreShift".to_string()),
        operation: OperationType::Create,
        payload_json: "{}".to_string(),
        timestamp: Utc::now(),
        is_urgent: false,
        logical_clock: 1,
        checksum: String::new(),
    };

    let result_ok = ShiftSyncSeal::validate_mutation_against_seal(&valid_mutation, &seals);
    assert!(result_ok.is_ok());

    let no_seals: Vec<ShiftSyncSeal> = vec![];
    let result_no_seals = ShiftSyncSeal::validate_mutation_against_seal(&mutation, &no_seals);
    assert!(result_no_seals.is_ok());
}
