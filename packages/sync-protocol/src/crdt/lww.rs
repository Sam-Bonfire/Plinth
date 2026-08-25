use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::hash::Hash;

use crate::clock::LogicalTimestamp;

/// A Last-Write-Wins Register storing a single value with a logical timestamp.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LwwRegister<T> {
    value: T,
    timestamp: LogicalTimestamp,
}

impl<T> LwwRegister<T>
where
    T: Clone + PartialEq + Serialize + for<'de> Deserialize<'de>,
{
    pub fn new(value: T, timestamp: LogicalTimestamp) -> Self {
        Self { value, timestamp }
    }

    pub fn value(&self) -> &T {
        &self.value
    }

    pub fn timestamp(&self) -> &LogicalTimestamp {
        &self.timestamp
    }

    pub fn set(&mut self, value: T, timestamp: LogicalTimestamp) -> bool {
        if timestamp > self.timestamp {
            self.value = value;
            self.timestamp = timestamp;
            true
        } else {
            false
        }
    }

    pub fn merge(&mut self, other: &Self) -> bool {
        if other.timestamp > self.timestamp {
            self.value = other.value.clone();
            self.timestamp = other.timestamp.clone();
            true
        } else {
            false
        }
    }

    pub fn into_value(self) -> T {
        self.value
    }
}

/// A Last-Write-Wins Element-Set tracking additions and removals of elements.
/// An element is present in the set if its add timestamp > remove timestamp.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(bound = "T: Eq + Hash + Clone + Serialize + for<'a> Deserialize<'a>")]
pub struct LwwElementSet<T>
where
    T: Eq + Hash + Clone,
{
    add_set: HashMap<T, LogicalTimestamp>,
    remove_set: HashMap<T, LogicalTimestamp>,
}

impl<T> Default for LwwElementSet<T>
where
    T: Eq + Hash + Clone,
{
    fn default() -> Self {
        Self::new()
    }
}

impl<T> LwwElementSet<T>
where
    T: Eq + Hash + Clone,
{
    #[must_use]
    pub fn new() -> Self {
        Self {
            add_set: HashMap::new(),
            remove_set: HashMap::new(),
        }
    }

    pub fn insert(&mut self, element: T, timestamp: LogicalTimestamp) -> bool {
        let current_ts = self.add_set.get(&element);
        #[allow(clippy::unnecessary_map_or)]
        if current_ts.map_or(true, |ts| timestamp > *ts) {
            self.add_set.insert(element, timestamp);
            true
        } else {
            false
        }
    }

    pub fn remove(&mut self, element: &T, timestamp: LogicalTimestamp) -> bool {
        let current_ts = self.remove_set.get(element);
        #[allow(clippy::unnecessary_map_or)]
        if current_ts.map_or(true, |ts| timestamp > *ts) {
            self.remove_set.insert(element.clone(), timestamp);
            true
        } else {
            false
        }
    }

    #[must_use]
    pub fn contains(&self, element: &T) -> bool {
        let add_ts = self.add_set.get(element);
        let remove_ts = self.remove_set.get(element);

        match (add_ts, remove_ts) {
            (Some(a), Some(r)) => a > r,
            (Some(_), None) => true,
            _ => false,
        }
    }

    #[must_use]
    pub fn elements(&self) -> Vec<T> {
        self.add_set
            .keys()
            .filter(|&k| self.contains(k))
            .cloned()
            .collect()
    }

    pub fn merge(&mut self, other: &Self) {
        for (k, v) in &other.add_set {
            self.insert(k.clone(), v.clone());
        }

        for (k, v) in &other.remove_set {
            self.remove(k, v.clone());
        }
    }

    #[must_use]
    pub fn is_empty(&self) -> bool {
        // Since is_empty needs to check if there are ANY active elements,
        // we can't just check if add_set is empty, because elements might be removed.
        // We can optimize this by finding if any element passes the contains check.
        !self.add_set.keys().any(|k| self.contains(k))
    }

    #[must_use]
    pub fn len(&self) -> usize {
        self.add_set.keys().filter(|&k| self.contains(k)).count()
    }
}
