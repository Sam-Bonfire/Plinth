use std::collections::{HashMap, HashSet};
use std::hash::Hash;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// An Observed-Remove Set (Add-Wins Set) CRDT.
/// Each added element is assigned a unique tag (UUID v7).
/// A remove operation removes only the tags currently observed by the removing node.
/// Concurrent additions of the same element create new distinct tags that survive deletion.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct OrSet<T: Eq + Hash + Clone> {
    /// Maps each element to the set of unique addition tags
    entries: HashMap<T, HashSet<Uuid>>,
    /// Tombstone set containing all deleted tags
    tombstones: HashSet<Uuid>,
}

impl<T: Eq + Hash + Clone> Default for OrSet<T> {
    fn default() -> Self {
        Self::new()
    }
}

impl<T: Eq + Hash + Clone> OrSet<T> {
    /// Creates a new empty `OrSet`.
    #[must_use]
    pub fn new() -> Self {
        Self {
            entries: HashMap::new(),
            tombstones: HashSet::new(),
        }
    }

    /// Adds an element to the set and returns the generated unique tag.
    pub fn add(&mut self, element: T) -> Uuid {
        let tag = Uuid::now_v7();
        self.add_with_tag(element, tag);
        tag
    }

    /// Adds an element to the set with a specific tag (used for replay or synchronization).
    pub fn add_with_tag(&mut self, element: T, tag: Uuid) {
        self.entries.entry(element).or_default().insert(tag);
    }

    /// Removes an element from the set by tombstoning all of its currently observed tags.
    /// Returns `true` if any active tags were removed.
    pub fn remove(&mut self, element: &T) -> bool {
        let mut active_removed = false;
        if let Some(tags) = self.entries.get(element) {
            for &tag in tags {
                if !self.tombstones.contains(&tag) {
                    active_removed = true;
                    self.tombstones.insert(tag);
                }
            }
        }
        active_removed
    }

    /// Explicitly removes a specific tag (tombstones it).
    pub fn remove_tag(&mut self, tag: Uuid) {
        self.tombstones.insert(tag);
    }

    /// Checks if the element is currently active in the set.
    #[must_use]
    pub fn contains(&self, element: &T) -> bool {
        if let Some(tags) = self.entries.get(element) {
            tags.iter().any(|tag| !self.tombstones.contains(tag))
        } else {
            false
        }
    }

    /// Returns a list of all active elements in the set.
    #[must_use]
    pub fn read(&self) -> Vec<T> {
        let mut active = Vec::new();
        for (element, tags) in &self.entries {
            if tags.iter().any(|tag| !self.tombstones.contains(tag)) {
                active.push(element.clone());
            }
        }
        active
    }

    /// Returns the set of un-tombstoned active tags for an element.
    #[must_use]
    pub fn active_tags(&self, element: &T) -> Option<HashSet<Uuid>> {
        self.entries.get(element).map(|tags| {
            tags.iter()
                .filter(|tag| !self.tombstones.contains(*tag))
                .copied()
                .collect()
        })
    }

    /// Merges another `OrSet` into this one.
    pub fn merge(&mut self, other: &Self) {
        // Union tombstones
        self.tombstones.extend(other.tombstones.iter().copied());

        // Merge entries
        for (element, other_tags) in &other.entries {
            let self_tags = self.entries.entry(element.clone()).or_default();
            self_tags.extend(other_tags.iter().copied());
        }

        // Clean up any entries whose tags are all present in tombstones
        self.compact();
    }

    /// Removes fully tombstoned entries from memory to save space.
    pub fn compact(&mut self) {
        self.entries.retain(|_, tags| {
            tags.retain(|tag| !self.tombstones.contains(tag));
            !tags.is_empty()
        });
    }

    /// Checks if there are any active elements in the set.
    #[must_use]
    pub fn is_empty(&self) -> bool {
        !self.entries.iter().any(|(_, tags)| {
            tags.iter().any(|tag| !self.tombstones.contains(tag))
        })
    }

    /// Returns the number of active elements in the set.
    #[must_use]
    pub fn len(&self) -> usize {
        self.entries
            .values()
            .filter(|tags| tags.iter().any(|tag| !self.tombstones.contains(tag)))
            .count()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_add_remove() {
        let mut set = OrSet::new();
        assert!(set.is_empty());
        assert_eq!(set.len(), 0);

        let item = "Garlic Naan".to_string();
        let _tag1 = set.add(item.clone());

        assert!(set.contains(&item));
        assert_eq!(set.len(), 1);
        assert!(!set.is_empty());
        assert_eq!(set.read(), vec![item.clone()]);
        assert_eq!(set.active_tags(&item).unwrap().len(), 1);

        // Remove element
        let removed = set.remove(&item);
        assert!(removed);
        assert!(!set.contains(&item));
        assert_eq!(set.len(), 0);
        assert!(set.is_empty());
        assert!(set.read().is_empty());
        assert!(set.active_tags(&item).unwrap().is_empty());
    }

    #[test]
    fn test_add_wins_concurrent_semantics() {
        let mut node1 = OrSet::new();
        let mut node2 = OrSet::new();
        let item = "Garlic Naan".to_string();

        let tag1 = Uuid::now_v7();
        node1.add_with_tag(item.clone(), tag1);
        node2.add_with_tag(item.clone(), tag1);

        // Offline divergence
        // Node 1 removes it
        node1.remove(&item);
        assert!(!node1.contains(&item));

        // Node 2 concurrently adds another instance
        let tag2 = node2.add(item.clone());
        assert!(node2.contains(&item));

        // Merge Node 1 and Node 2
        node1.merge(&node2);

        // Add Wins: Garlic Naan must be present with tag2
        assert!(node1.contains(&item));
        assert_eq!(node1.len(), 1);

        let active = node1.active_tags(&item).unwrap();
        assert!(active.contains(&tag2));
        assert!(!active.contains(&tag1));
    }

    #[test]
    fn test_crdt_properties() {
        let mut set_a = OrSet::new();
        set_a.add("Apple".to_string());

        let mut set_b = OrSet::new();
        set_b.add("Banana".to_string());

        let mut set_c = OrSet::new();
        set_c.add("Cherry".to_string());

        // Commutativity: A + B == B + A
        let mut a_plus_b = set_a.clone();
        a_plus_b.merge(&set_b);

        let mut b_plus_a = set_b.clone();
        b_plus_a.merge(&set_a);

        assert_eq!(a_plus_b.read().len(), 2);
        assert!(a_plus_b.contains(&"Apple".to_string()));
        assert!(a_plus_b.contains(&"Banana".to_string()));
        assert_eq!(a_plus_b, b_plus_a);

        // Associativity: (A + B) + C == A + (B + C)
        let mut a_plus_b_plus_c = a_plus_b.clone();
        a_plus_b_plus_c.merge(&set_c);

        let mut b_plus_c = set_b.clone();
        b_plus_c.merge(&set_c);
        let mut a_plus_b_plus_c2 = set_a.clone();
        a_plus_b_plus_c2.merge(&b_plus_c);

        assert_eq!(a_plus_b_plus_c, a_plus_b_plus_c2);

        // Idempotency: A + A == A
        let mut a_plus_a = set_a.clone();
        a_plus_a.merge(&set_a);
        assert_eq!(a_plus_a, set_a);
    }

    #[test]
    fn test_serialization_roundtrip() {
        let mut set = OrSet::new();
        set.add("Biryani".to_string());
        set.add("Tikka Masala".to_string());
        set.remove(&"Biryani".to_string());

        // JSON
        let json = serde_json::to_string(&set).unwrap();
        let decoded_json: OrSet<String> = serde_json::from_str(&json).unwrap();
        assert_eq!(set, decoded_json);

        // Bincode
        let binary = bincode::serialize(&set).unwrap();
        let decoded_bin: OrSet<String> = bincode::deserialize(&binary).unwrap();
        assert_eq!(set, decoded_bin);
    }

    #[test]
    fn test_compaction() {
        let mut set = OrSet::new();
        let item = "Samosa".to_string();

        set.add(item.clone());
        set.remove(&item);

        assert!(!set.entries.is_empty());
        assert!(!set.tombstones.is_empty());

        set.compact();

        assert!(set.entries.is_empty());
        assert!(!set.tombstones.is_empty());

        set.add(item.clone());
        set.compact();
        assert!(!set.entries.is_empty());
    }
}
