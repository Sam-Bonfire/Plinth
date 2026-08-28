use crate::value_objects::money::Money;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

/// A specific choice inside a modifier group
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct ModifierOption {
    /// Unique ID of this option
    pub id: Uuid,
    /// Name of the option (e.g., "Extra Cheese")
    pub name: String,
    /// Price adjustment (can be zero)
    pub price_delta: Money,
}

/// Constraints for modifier groups
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub enum ModifierGroupType {
    /// Customer must choose exactly one (if required) or at most one (if optional)
    SingleChoice,
    /// Customer can choose multiple options
    MultiChoice {
        /// The maximum number of options a customer can pick
        max_selections: Option<u32>
    },
}

/// A grouping of modifier options (e.g., "Crust Type", "Toppings")
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct ModifierGroup {
    /// Unique ID of the group
    pub id: Uuid,
    /// Display name of the group
    pub name: String,
    /// Rules for selection
    pub group_type: ModifierGroupType,
    /// Whether a selection is mandatory
    pub required: bool,
    /// The available options
    pub options: Vec<ModifierOption>,
}

/// Customer's selection from a modifier group
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, specta::Type)]
pub struct ModifierSelection {
    /// ID of the `ModifierGroup`
    pub group_id: Uuid,
    /// The selected option IDs
    pub selected_options: Vec<Uuid>,
    /// Customer's special textual instructions
    pub special_instructions: Option<String>,
}

/// Errors in modifier selection validation
#[derive(Error, Debug, PartialEq, Eq)]
pub enum ModifierError {
    /// The selections exceeded the maximum allowed
    #[error("Selections exceed the maximum allowed for this group")]
    ExceedsMaxSelections,
    /// A required group had zero selections
    #[error("Required modifier group is empty")]
    RequiredGroupEmpty,
    /// An invalid option ID was provided
    #[error("Invalid modifier option ID selected")]
    InvalidOptionId,
}

impl ModifierSelection {
    /// Validates the selection and calculates the total price delta.
    ///
    /// # Errors
    /// Returns `ModifierError` if the selection is invalid.
    /// 
    /// # Panics
    /// Panics if adding price deltas overflows.
    pub fn total_price_delta(&self, group: &ModifierGroup) -> Result<Money, ModifierError> {
        if self.selected_options.is_empty() && group.required {
            return Err(ModifierError::RequiredGroupEmpty);
        }

        match group.group_type {
            ModifierGroupType::SingleChoice => {
                if self.selected_options.len() > 1 {
                    return Err(ModifierError::ExceedsMaxSelections);
                }
            }
            ModifierGroupType::MultiChoice { max_selections } => {
                if let Some(max_allowed) = max_selections {
                    if self.selected_options.len() > max_allowed as usize {
                        return Err(ModifierError::ExceedsMaxSelections);
                    }
                }
            }
        }

        let mut total: Option<Money> = None;

        for selected_id in &self.selected_options {
            let option = group
                .options
                .iter()
                .find(|opt| opt.id == *selected_id)
                .ok_or(ModifierError::InvalidOptionId)?;

            if let Some(ref mut t) = total {
                *t = t.add(&option.price_delta).unwrap();
            } else {
                total = Some(option.price_delta.clone());
            }
        }

        Ok(total.unwrap_or_else(|| {
            if let Some(first_opt) = group.options.first() {
                Money::zero(first_opt.price_delta.currency)
            } else {
                Money::zero(crate::value_objects::money::Currency::Inr)
            }
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;
    use crate::value_objects::money::Currency;

    #[test]
    fn test_modifier_selection() {
        let opt1 = ModifierOption {
            id: Uuid::now_v7(),
            name: "Cheese".to_string(),
            price_delta: Money { amount: Decimal::new(20, 0), currency: Currency::Inr },
        };
        let group = ModifierGroup {
            id: Uuid::now_v7(),
            name: "Addons".to_string(),
            group_type: ModifierGroupType::MultiChoice { max_selections: Some(2) },
            required: false,
            options: vec![opt1.clone()],
        };

        let selection = ModifierSelection {
            group_id: group.id,
            selected_options: vec![opt1.id],
            special_instructions: None,
        };

        let delta = selection.total_price_delta(&group).unwrap();
        assert_eq!(delta.amount, Decimal::new(20, 0));
    }
}
