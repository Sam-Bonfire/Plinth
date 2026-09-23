#![deny(unsafe_code)]

use crate::ids::{AccountId, MessEntryId};
use serde::{Deserialize, Serialize};
use specta::Type;

/// Represents an entry in the double-entry Mess Ledger.
/// Exactly one of `debit_minor` or `credit_minor` must be strictly positive.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Type)]
pub struct MessEntry {
    pub id: MessEntryId,
    pub account_id: AccountId,
    pub debit_minor: i64,
    pub credit_minor: i64,
    pub memo: String,
}

impl MessEntry {
    /// Creates a new `MessEntry`.
    ///
    /// # Errors
    /// Returns an error if the invariants are not met:
    /// - Cannot be both a debit and a credit.
    /// - Cannot be neither a debit nor a credit (zero amount).
    /// - Amounts cannot be negative.
    pub fn new(
        account_id: AccountId,
        debit_minor: i64,
        credit_minor: i64,
        memo: String,
    ) -> Result<Self, &'static str> {
        if debit_minor < 0 || credit_minor < 0 {
            return Err("Amounts cannot be negative");
        }

        let is_debit = debit_minor > 0;
        let is_credit = credit_minor > 0;

        if is_debit && is_credit {
            return Err("Entry cannot be both a debit and a credit");
        }

        if !is_debit && !is_credit {
            return Err("Entry must be strictly positive on either debit or credit");
        }

        Ok(Self {
            id: MessEntryId::new(),
            account_id,
            debit_minor,
            credit_minor,
            memo,
        })
    }
}

/// Validates a batch of entries and ensures they balance (sum of debits == sum of credits).
///
/// # Errors
/// Returns an error if the batch is empty or unbalanced.
pub fn post_batch(entries: &[MessEntry]) -> Result<(), &'static str> {
    if entries.is_empty() {
        return Err("Batch cannot be empty");
    }

    let mut total_debits = 0i64;
    let mut total_credits = 0i64;

    for entry in entries {
        total_debits = total_debits.checked_add(entry.debit_minor).ok_or("Debit overflow")?;
        total_credits = total_credits.checked_add(entry.credit_minor).ok_or("Credit overflow")?;
    }

    if total_debits != total_credits {
        return Err("Batch is not balanced: total debits must equal total credits");
    }

    Ok(())
}

/// Calculates the balance of an account from a list of entries.
/// Balance is defined as sum of credits minus sum of debits.
#[must_use]
pub fn calculate_account_balance(entries: &[MessEntry]) -> i64 {
    let mut balance = 0i64;
    for entry in entries {
        // Since entries invariants hold, one is >0 and the other is 0
        balance = balance.saturating_add(entry.credit_minor);
        balance = balance.saturating_sub(entry.debit_minor);
    }
    balance
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mess_entry_invariants() {
        let account_id = AccountId::new();

        // Valid Debit
        assert!(MessEntry::new(account_id, 100, 0, "Debit".to_string()).is_ok());

        // Valid Credit
        assert!(MessEntry::new(account_id, 0, 100, "Credit".to_string()).is_ok());

        // Invalid: Both positive
        let err = MessEntry::new(account_id, 100, 100, "Both".to_string());
        assert_eq!(err, Err("Entry cannot be both a debit and a credit"));

        // Invalid: Both zero
        let err = MessEntry::new(account_id, 0, 0, "Neither".to_string());
        assert_eq!(
            err,
            Err("Entry must be strictly positive on either debit or credit")
        );

        // Invalid: Negative amount
        let err = MessEntry::new(account_id, -100, 0, "Negative".to_string());
        assert_eq!(err, Err("Amounts cannot be negative"));
    }

    #[test]
    fn test_post_batch_balanced() {
        let acc1 = AccountId::new();
        let acc2 = AccountId::new();

        let entries = vec![
            MessEntry::new(acc1, 100, 0, "Debit".to_string()).unwrap(),
            MessEntry::new(acc2, 0, 100, "Credit".to_string()).unwrap(),
        ];

        assert!(post_batch(&entries).is_ok());
    }

    #[test]
    fn test_post_batch_unbalanced() {
        let acc1 = AccountId::new();
        let acc2 = AccountId::new();

        let entries = vec![
            MessEntry::new(acc1, 100, 0, "Debit".to_string()).unwrap(),
            MessEntry::new(acc2, 0, 50, "Credit".to_string()).unwrap(),
        ];

        let err = post_batch(&entries);
        assert_eq!(
            err,
            Err("Batch is not balanced: total debits must equal total credits")
        );
    }

    #[test]
    fn test_post_batch_empty() {
        let entries: Vec<MessEntry> = vec![];
        let err = post_batch(&entries);
        assert_eq!(err, Err("Batch cannot be empty"));
    }

    #[test]
    fn test_calculate_account_balance() {
        let acc = AccountId::new();

        let entries = vec![
            MessEntry::new(acc, 0, 500, "Initial deposit".to_string()).unwrap(),
            MessEntry::new(acc, 200, 0, "Withdrawal".to_string()).unwrap(),
            MessEntry::new(acc, 0, 100, "Credit".to_string()).unwrap(),
            MessEntry::new(acc, 400, 0, "Another Withdrawal".to_string()).unwrap(),
        ];

        let balance = calculate_account_balance(&entries);
        // credits: 500 + 100 = 600
        // debits: 200 + 400 = 600
        // balance = credits - debits = 0
        assert_eq!(balance, 0);

        let entries2 = vec![
            MessEntry::new(acc, 0, 1000, "Initial deposit".to_string()).unwrap(),
            MessEntry::new(acc, 250, 0, "Withdrawal".to_string()).unwrap(),
        ];
        // 1000 - 250 = 750
        assert_eq!(calculate_account_balance(&entries2), 750);
    }
}
