pub mod customers;

/// Binds a minor-unit amount for D1.
///
/// `i64::into(JsValue)` produces a JavaScript `bigint`, which D1 rejects with
/// `D1_TYPE_ERROR`. A number is accepted, and `SQLite`'s INTEGER affinity stores
/// an integral number back as INTEGER, so the column keeps its semantics.
///
/// shortcut: amounts above 2^53 minor units lose precision; no restaurant
/// ticket or ledger entry reaches that.
#[must_use]
pub fn money(value: i64) -> worker::wasm_bindgen::JsValue {
    #[allow(clippy::cast_precision_loss)]
    let bound = value as f64;
    bound.into()
}
pub mod migrations;
pub mod session;

pub use customers::{CustomerRow, LoginEventRow};
pub use session::{TenantContext, TenantDbSession};
pub mod tenants;
pub use tenants::*;
