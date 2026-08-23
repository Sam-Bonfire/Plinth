#![deny(unsafe_code)]

pub mod models;
pub mod ports;
pub mod services;

use rust_decimal::Decimal;
use wasm_bindgen::prelude::*;
use std::str::FromStr;

/// Validates if the given amount string is a valid positive decimal.
///
/// # Errors
///
/// Returns a `JsValue` error if the string is not a valid decimal format.
#[wasm_bindgen]
pub fn validate_amount(amount_str: &str) -> Result<bool, JsValue> {
    match Decimal::from_str(amount_str) {
        Ok(decimal) => Ok(decimal > Decimal::ZERO),
        Err(_) => Err(JsValue::from_str("Invalid decimal format")),
    }
}

/// Calculates the tax given an amount and a tax rate.
///
/// # Errors
///
/// Returns a `JsValue` error if the amount or tax rate string is not a valid decimal format.
#[wasm_bindgen]
pub fn calculate_tax(amount_str: &str, tax_rate_str: &str) -> Result<String, JsValue> {
    let amount = Decimal::from_str(amount_str)
        .map_err(|_| JsValue::from_str("Invalid amount format"))?;
    let tax_rate = Decimal::from_str(tax_rate_str)
        .map_err(|_| JsValue::from_str("Invalid tax rate format"))?;

    let tax = amount * tax_rate;
    // Standard rounding for financial calculations (banker's rounding or half up - keeping it simple for sample)
    let tax_rounded = tax.round_dp(2);

    Ok(tax_rounded.to_string())
}

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
