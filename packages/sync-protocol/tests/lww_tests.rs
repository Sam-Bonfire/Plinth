use sync_protocol::clock::{ClientNodeId, LogicalTimestamp};
use sync_protocol::crdt::{LwwElementSet, LwwRegister};

fn make_ts(physical: u64, counter: u64, node_id: &str) -> LogicalTimestamp {
    LogicalTimestamp {
        wall_clock_ms: physical.try_into().unwrap_or(0),
        counter,
        node_id: ClientNodeId(node_id.to_string()),
    }
}

#[test]
fn test_lww_register_convergence_and_commutativity() {
    let ts1 = make_ts(100, 0, "node1");
    let ts2 = make_ts(200, 0, "node2");

    let reg1 = LwwRegister::new("Value A".to_string(), ts1.clone());
    let reg2 = LwwRegister::new("Value B".to_string(), ts2.clone());

    // Commutativity: merge(reg1, reg2) should equal merge(reg2, reg1)
    let mut reg1_clone = reg1.clone();
    let mut reg2_clone = reg2.clone();

    reg1_clone.merge(&reg2);
    reg2_clone.merge(&reg1);

    assert_eq!(reg1_clone.value(), "Value B");
    assert_eq!(reg2_clone.value(), "Value B");
    assert_eq!(reg1_clone, reg2_clone);
}

#[test]
fn test_tie_breaking_determinism() {
    // Same physical, tie-broken by counter
    let ts1 = make_ts(100, 1, "node1");
    let ts2 = make_ts(100, 2, "node2");

    let mut reg1 = LwwRegister::new("Value A".to_string(), ts1.clone());
    let reg2 = LwwRegister::new("Value B".to_string(), ts2.clone());

    reg1.merge(&reg2);
    assert_eq!(reg1.value(), "Value B"); // ts2 wins because counter 2 > 1

    // Same physical, same counter, tie-broken by node_id (lexicographical comparison)
    // "nodeB" > "nodeA"
    let ts3 = make_ts(100, 1, "nodeA");
    let ts4 = make_ts(100, 1, "nodeB");

    let mut reg3 = LwwRegister::new("Value A".to_string(), ts3.clone());
    let reg4 = LwwRegister::new("Value B".to_string(), ts4.clone());

    reg3.merge(&reg4);
    assert_eq!(reg3.value(), "Value B"); // ts4 wins because "nodeB" > "nodeA"
}

#[test]
fn test_lww_element_set_add_remove() {
    let mut set = LwwElementSet::new();

    // Insert element at T1
    let ts1 = make_ts(100, 0, "node1");
    set.insert("item1".to_string(), ts1.clone());
    assert!(set.contains(&"item1".to_string()));

    // Remove element at T2 (T2 > T1)
    let ts2 = make_ts(200, 0, "node1");
    set.remove(&"item1".to_string(), ts2.clone());
    assert!(!set.contains(&"item1".to_string()));

    // Out-of-order packet simulation
    let mut out_of_order_set = LwwElementSet::new();

    // Apply Remove at T2 first
    out_of_order_set.remove(&"item2".to_string(), ts2.clone());
    assert!(!out_of_order_set.contains(&"item2".to_string()));

    // Then Insert at T1 (T1 < T2)
    out_of_order_set.insert("item2".to_string(), ts1.clone());

    // Element should remain removed because remove timestamp > add timestamp
    assert!(!out_of_order_set.contains(&"item2".to_string()));
}

#[test]
fn test_multi_outlet_concurrent_86_simulation() {
    let mut term1 = LwwElementSet::new();
    let mut term2 = LwwElementSet::new();
    let mut term3 = LwwElementSet::new();

    let item_id = "menu_item_42".to_string();

    // Term 1 86's the item (adds to set)
    let ts_t1 = make_ts(100, 0, "term1");
    term1.insert(item_id.clone(), ts_t1);

    // Term 2 un-86's the item (removes from set) but with a later timestamp
    let ts_t2 = make_ts(150, 0, "term2");
    term2.remove(&item_id, ts_t2);

    // Term 3 86's the item again with an even later timestamp
    let ts_t3 = make_ts(200, 0, "term3");
    term3.insert(item_id.clone(), ts_t3);

    // Arbitrary merge order 1: Term1 -> Term2 -> Term3
    let mut state1 = term1.clone();
    state1.merge(&term2);
    state1.merge(&term3);

    // Arbitrary merge order 2: Term3 -> Term2 -> Term1
    let mut state2 = term3.clone();
    state2.merge(&term2);
    state2.merge(&term1);

    // Arbitrary merge order 3: Term2 -> Term3 -> Term1
    let mut state3 = term2.clone();
    state3.merge(&term3);
    state3.merge(&term1);

    // All nodes should converge on the exact same availability state
    assert_eq!(state1, state2);
    assert_eq!(state2, state3);

    // Because T3 is the latest, the item should be considered 86'd (in the set)
    assert!(state1.contains(&item_id));
}
