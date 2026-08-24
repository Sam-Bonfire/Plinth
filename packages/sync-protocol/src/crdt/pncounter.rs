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
        let p_sum: Decimal = self.positive_map.values().sum();
        let n_sum: Decimal = self.negative_map.values().sum();
        p_sum - n_sum
    }

    /// Increments the counter by `amount` for `node`.
    ///
    /// # Panics
    ///
    /// Panics if `amount` is negative.
    pub fn increment(&mut self, node: ClientNodeId, amount: Decimal) {
        assert!(amount >= Decimal::ZERO, "Increment amount must be >= 0");
        *self.positive_map.entry(node).or_insert(Decimal::ZERO) += amount;
    }

    /// Decrements the counter by `amount` for `node`.
    ///
    /// # Panics
    ///
    /// Panics if `amount` is negative.
    pub fn decrement(&mut self, node: ClientNodeId, amount: Decimal) {
        assert!(amount >= Decimal::ZERO, "Decrement amount must be >= 0");
        *self.negative_map.entry(node).or_insert(Decimal::ZERO) += amount;
    }

    pub fn merge(&mut self, other: &Self) {
        for (node, other_p) in &other.positive_map {
            let self_p = self.positive_map.entry(node.clone()).or_insert(Decimal::ZERO);
            if *other_p > *self_p {
                *self_p = *other_p;
            }
        }

        for (node, other_n) in &other.negative_map {
            let self_n = self.negative_map.entry(node.clone()).or_insert(Decimal::ZERO);
            if *other_n > *self_n {
                *self_n = *other_n;
            }
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
    use rust_decimal_macros::dec;
    use super::*;


    fn node(id: &str) -> ClientNodeId {
        ClientNodeId(id.to_string())
    }

    #[test]
    fn test_basic_increment_decrement() {
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
