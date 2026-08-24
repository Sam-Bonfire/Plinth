use std::cmp;
use std::collections::BTreeMap;

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

use crate::clock::ClientNodeId;

/// A Positive-Negative Counter (PN-Counter) CRDT using high-precision Decimal.
/// Tracks per-node positive increments (P) and negative decrements (N).
/// Value = sum(P) - sum(N).
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct PNCounter {
    positive_map: BTreeMap<ClientNodeId, Decimal>,
    negative_map: BTreeMap<ClientNodeId, Decimal>,
}

impl PNCounter {
    #[must_use]
    pub fn new() -> Self {
        Self::default()
    }

    #[must_use]
    pub fn value(&self) -> Decimal {
        let pos_sum: Decimal = self.positive_map.values().sum();
        let neg_sum: Decimal = self.negative_map.values().sum();
        pos_sum - neg_sum
    }

    /// # Panics
    /// Panics if `amount` is negative.
    pub fn increment(&mut self, node: ClientNodeId, amount: Decimal) {
        assert!(
            amount >= Decimal::ZERO,
            "increment amount must be non-negative"
        );
        let entry = self.positive_map.entry(node).or_insert(Decimal::ZERO);
        *entry += amount;
    }

    /// # Panics
    /// Panics if `amount` is negative.
    pub fn decrement(&mut self, node: ClientNodeId, amount: Decimal) {
        assert!(
            amount >= Decimal::ZERO,
            "decrement amount must be non-negative"
        );
        let entry = self.negative_map.entry(node).or_insert(Decimal::ZERO);
        *entry += amount;
    }

    pub fn merge(&mut self, other: &Self) {
        for (&node, &other_p) in &other.positive_map {
            let entry = self.positive_map.entry(node).or_insert(Decimal::ZERO);
            *entry = cmp::max(*entry, other_p);
        }
        for (&node, &other_n) in &other.negative_map {
            let entry = self.negative_map.entry(node).or_insert(Decimal::ZERO);
            *entry = cmp::max(*entry, other_n);
        }
    }

    #[must_use]
    pub fn is_zero(&self) -> bool {
        self.value().is_zero()
    }

    #[must_use]
    pub fn is_negative(&self) -> bool {
        self.value().is_sign_negative()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;
    use uuid::Uuid;

    fn node_id(id: u8) -> ClientNodeId {
        ClientNodeId(Uuid::from_bytes([
            0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, id,
        ]))

    fn node(id: &str) -> ClientNodeId {
        ClientNodeId(id.to_string())
    }

    #[test]
    fn test_basic_increment_decrement() {
        let node_a = node_id(1);
        let mut counter = PNCounter::new();

        // Node A adds 50.0 kg
        counter.increment(node_a, dec!(50.0));
        assert_eq!(counter.value(), dec!(50.0));

        // Node A sells 12.5 kg
        counter.decrement(node_a, dec!(12.5));
        assert_eq!(counter.value(), dec!(37.5));

        assert!(!counter.is_zero());
        assert!(!counter.is_negative());
        let mut counter = PNCounter::new();
        assert!(counter.is_zero());
        assert_eq!(counter.value(), dec!(0));

        // Node A adds 50.0
        counter.increment(node("A"), dec!(50.0));
        assert_eq!(counter.value(), dec!(50.0));

        // Node A deducts 12.5
        counter.decrement(node("A"), dec!(12.5));
        assert_eq!(counter.value(), dec!(37.5));
    }

    #[test]
    fn test_multi_terminal_concurrent_deductions() {
        let node_a = node_id(1);
        let node_b = node_id(2);
        let node_c = node_id(3);

        // Initial stock: 100.0 kg added by Node A
        let mut base = PNCounter::new();
        base.increment(node_a, dec!(100.0));

        // 3 terminals offline concurrently
        let mut term_a = base.clone();
        let mut term_b = base.clone();
        let mut term_c = base.clone();

        // Node A deducts 10.0 kg
        term_a.decrement(node_a, dec!(10.0));
        // Node B deducts 15.0 kg
        term_b.decrement(node_b, dec!(15.0));
        // Node C deducts 20.0 kg
        term_c.decrement(node_c, dec!(20.0));

        // Arbitrary merge order (A -> B -> C)
        let mut merged1 = term_a.clone();
        merged1.merge(&term_b);
        merged1.merge(&term_c);

        assert_eq!(merged1.value(), dec!(55.0));

        // Different merge order (C -> A -> B)
        let mut merged2 = term_c.clone();
        merged2.merge(&term_a);
        merged2.merge(&term_b);

        assert_eq!(merged2.value(), dec!(55.0));
    }

    #[test]
    fn test_crdt_properties() {
        let node_a = node_id(1);
        let node_b = node_id(2);
        let node_c = node_id(3);

        let mut a = PNCounter::new();
        a.increment(node_a, dec!(10.0));
        a.decrement(node_a, dec!(2.0));

        let mut b = PNCounter::new();
        b.increment(node_b, dec!(5.0));
        b.decrement(node_b, dec!(1.0));

        let mut c = PNCounter::new();
        c.increment(node_c, dec!(15.0));
        c.decrement(node_c, dec!(5.0));

        // Commutativity: merge(A, B) == merge(B, A)
        let mut a_merge_b = a.clone();
        a_merge_b.merge(&b);
        let mut b_merge_a = b.clone();
        b_merge_a.merge(&a);
        assert_eq!(a_merge_b, b_merge_a);
        assert_eq!(a_merge_b.value(), dec!(12.0)); // (10-2) + (5-1)

        // Associativity: merge(A, merge(B, C)) == merge(merge(A, B), C)
        let mut b_merge_c = b.clone();
        b_merge_c.merge(&c);
        let mut a_merge_bc = a.clone();
        a_merge_bc.merge(&b_merge_c);

        let mut ab_merge_c = a_merge_b.clone();
        ab_merge_c.merge(&c);
        assert_eq!(a_merge_bc, ab_merge_c);
        assert_eq!(a_merge_bc.value(), dec!(22.0)); // 12 + (15-5)

        // Idempotency: merge(A, A) == A
        let mut a_merge_a = a.clone();
        a_merge_a.merge(&a);
        assert_eq!(a_merge_a, a);
        assert_eq!(a_merge_a.value(), dec!(8.0));
    }

    #[test]
    fn test_serialization_roundtrip() {
        let node_a = node_id(1);
        let mut counter = PNCounter::new();
        counter.increment(node_a, dec!(100.0));
        counter.decrement(node_a, dec!(25.5));

        // JSON Serialization
        let json_str = serde_json::to_string(&counter).expect("failed to serialize JSON");
        let json_deserialized: PNCounter = serde_json::from_str(&json_str).expect("failed to deserialize JSON");
        assert_eq!(counter, json_deserialized);

        // Bincode Serialization
        let bincode_bytes = bincode::serialize(&counter).expect("failed to serialize bincode");
        let bincode_deserialized: PNCounter = bincode::deserialize(&bincode_bytes).expect("failed to deserialize bincode");
        assert_eq!(counter, bincode_deserialized);
        let mut node_a = PNCounter::new();
        node_a.increment(node("A"), dec!(100.0));

        // Simulate 3 terminals offline concurrently syncing the initial state
        let mut node_b = node_a.clone();
        let mut node_c = node_a.clone();

        // Node A deducts 10.0
        node_a.decrement(node("A"), dec!(10.0));

        // Node B deducts 15.0
        node_b.decrement(node("B"), dec!(15.0));

        // Node C deducts 20.0
        node_c.decrement(node("C"), dec!(20.0));

        // Merge in arbitrary order (A -> B, B -> C, then C -> A and C -> B)
        node_b.merge(&node_a);
        node_c.merge(&node_b);
        node_a.merge(&node_c);
        node_b.merge(&node_c);

        assert_eq!(node_a.value(), dec!(55.0));
        assert_eq!(node_b.value(), dec!(55.0));
        assert_eq!(node_c.value(), dec!(55.0));
    }

    #[test]
    fn test_commutativity() {
        let mut a = PNCounter::new();
        a.increment(node("A"), dec!(10.0));
        a.decrement(node("A"), dec!(2.0));

        let mut b = PNCounter::new();
        b.increment(node("B"), dec!(5.0));
        b.decrement(node("B"), dec!(1.0));

        let mut ab = a.clone();
        ab.merge(&b);

        let mut ba = b.clone();
        ba.merge(&a);

        assert_eq!(ab, ba);
    }

    #[test]
    fn test_associativity() {
        let mut a = PNCounter::new();
        a.increment(node("A"), dec!(10.0));

        let mut b = PNCounter::new();
        b.decrement(node("B"), dec!(5.0));

        let mut c = PNCounter::new();
        c.increment(node("C"), dec!(20.0));

        // (A merge B) merge C
        let mut ab_c = a.clone();
        ab_c.merge(&b);
        ab_c.merge(&c);

        // A merge (B merge C)
        let mut a_bc = a.clone();
        let mut bc = b.clone();
        bc.merge(&c);
        a_bc.merge(&bc);

        assert_eq!(ab_c, a_bc);
    }

    #[test]
    fn test_idempotency() {
        let mut a = PNCounter::new();
        a.increment(node("A"), dec!(10.0));
        a.decrement(node("A"), dec!(2.0));

        let mut a_merged = a.clone();
        a_merged.merge(&a);

        assert_eq!(a, a_merged);
    }

    #[test]
    fn test_serialization() {
        let mut a = PNCounter::new();
        a.increment(node("A"), dec!(10.5));
        a.decrement(node("A"), dec!(2.25));

        let json = serde_json::to_string(&a).unwrap();
        let deserialized: PNCounter = serde_json::from_str(&json).unwrap();
        assert_eq!(a, deserialized);
    }

    #[test]
    fn test_bincode_serialization() {
        let mut a = PNCounter::new();
        a.increment(node("A"), dec!(10.5));
        a.decrement(node("A"), dec!(2.25));

        let encoded = bincode::serialize(&a).unwrap();
        let decoded: PNCounter = bincode::deserialize(&encoded).unwrap();
        assert_eq!(a, decoded);
    }
}
