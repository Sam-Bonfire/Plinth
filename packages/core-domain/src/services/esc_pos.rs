#![forbid(unsafe_code)]

use crate::value_objects::money::Money;

/// One printable line item. All money uses [`Money`] (`rust_decimal`), never float.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EscPosLine {
    pub name: String,
    pub qty: u32,
    pub unit: Money,
    pub total: Money,
}

/// Printable receipt / KOT document. Plain data, no I/O.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct EscPosDoc {
    pub header: Vec<String>,
    pub lines: Vec<EscPosLine>,
    pub footer: Vec<String>,
}

const INIT: &[u8] = &[0x1B, 0x40];
const ALIGN_CENTER: &[u8] = &[0x1B, 0x61, 0x01];
const ALIGN_LEFT: &[u8] = &[0x1B, 0x61, 0x00];
const BOLD_ON: &[u8] = &[0x1B, 0x45, 0x01];
const BOLD_OFF: &[u8] = &[0x1B, 0x45, 0x00];
const CUT: &[u8] = &[0x0A, 0x0A, 0x1D, 0x56, 0x00];
const WIDTH: usize = 32;

fn money_str(m: &Money) -> String {
    format!("Rs {:.2}", m.amount)
}

fn push_centered(out: &mut Vec<u8>, s: &str) {
    out.extend_from_slice(ALIGN_CENTER);
    out.extend_from_slice(s.as_bytes());
    out.push(0x0A);
}

fn push_left(out: &mut Vec<u8>, s: &str) {
    out.extend_from_slice(ALIGN_LEFT);
    out.extend_from_slice(s.as_bytes());
    out.push(0x0A);
}

/// Build receipt bytes: header (centered, bold), items, totals, footer, cut.
#[must_use]
pub fn receipt_bytes(doc: &EscPosDoc, grand_total: &Money) -> Vec<u8> {
    let mut out = Vec::with_capacity(512);
    out.extend_from_slice(INIT);
    out.extend_from_slice(BOLD_ON);
    for h in &doc.header {
        push_centered(&mut out, h);
    }
    out.extend_from_slice(BOLD_OFF);
    out.extend_from_slice(ALIGN_LEFT);
    out.extend_from_slice(format!("{:-<32}\n", "").as_bytes());
    for l in &doc.lines {
        let name: String = l.name.chars().take(20).collect();
        let left = format!("{} x{}", name, l.qty);
        let right = money_str(&l.total);
        let pad = WIDTH.saturating_sub(left.len() + right.len());
        push_left(
            &mut out,
            &format!("{left}{}{right}", " ".repeat(pad)),
        );
    }
    out.extend_from_slice(format!("{:-<32}\n", "").as_bytes());
    out.extend_from_slice(BOLD_ON);
    push_left(&mut out, &format!("TOTAL: {}", money_str(grand_total)));
    out.extend_from_slice(BOLD_OFF);
    for f in &doc.footer {
        push_centered(&mut out, f);
    }
    out.extend_from_slice(CUT);
    out
}

/// Build KOT bytes: header + item names/qty only (no prices), cut.
#[must_use]
pub fn kot_bytes(doc: &EscPosDoc) -> Vec<u8> {
    let mut out = Vec::with_capacity(256);
    out.extend_from_slice(INIT);
    out.extend_from_slice(BOLD_ON);
    for h in &doc.header {
        push_centered(&mut out, h);
    }
    out.extend_from_slice(BOLD_OFF);
    for l in &doc.lines {
        let name: String = l.name.chars().take(28).collect();
        push_left(&mut out, &format!("{} x{}", name, l.qty));
    }
    for f in &doc.footer {
        push_centered(&mut out, f);
    }
    out.extend_from_slice(CUT);
    out
}

/// Cash drawer kick pulse: `ESC p 0 25 250` (pin 2, 50ms on, 500ms off).
#[must_use]
pub fn cash_drawer_kick() -> Vec<u8> {
    vec![0x1B, 0x70, 0x00, 25, 250]
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::value_objects::money::Currency;
    use rust_decimal::Decimal;

    fn money(major: i64) -> Money {
        Money {
            amount: Decimal::from(major),
            currency: Currency::Inr,
        }
    }

    #[test]
    fn receipt_roundtrip_golden_bytes() {
        let doc = EscPosDoc {
            header: vec!["PLINTH CAFE".to_string()],
            lines: vec![EscPosLine {
                name: "Masala Dosa".to_string(),
                qty: 2,
                unit: money(120),
                total: money(240),
            }],
            footer: vec!["Thank you".to_string()],
        };
        let b = receipt_bytes(&doc, &money(240));
        assert!(b.starts_with(INIT));
        assert!(b.ends_with(CUT));
        let s = String::from_utf8_lossy(&b);
        assert!(s.contains("PLINTH CAFE"));
        assert!(s.contains("Masala Dosa x2"));
        assert!(s.contains("Rs 240.00"));
        assert!(s.contains("TOTAL: Rs 240.00"));
    }

    #[test]
    fn kot_omits_prices() {
        let doc = EscPosDoc {
            header: vec!["KOT".to_string()],
            lines: vec![EscPosLine {
                name: "Paneer Tikka".to_string(),
                qty: 1,
                unit: money(200),
                total: money(200),
            }],
            footer: vec![],
        };
        let bytes = kot_bytes(&doc);
        let s = String::from_utf8_lossy(&bytes);
        assert!(s.contains("Paneer Tikka x1"));
        assert!(!s.contains("Rs"));
    }

    #[test]
    fn empty_doc_still_cuts() {
        let b = receipt_bytes(&EscPosDoc::default(), &money(0));
        assert!(b.ends_with(CUT));
    }

    #[test]
    fn drawer_kick_emits_exact_pulse() {
        assert_eq!(cash_drawer_kick(), vec![0x1B, 0x70, 0x00, 25, 250]);
    }
}
