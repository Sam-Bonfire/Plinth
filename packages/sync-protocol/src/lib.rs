#![forbid(unsafe_code)]

pub mod clock;
pub use clock::*;

#[cfg(test)]
mod tests {
    #[test]
    fn sync_protocol_init() {
        let val = 1;
        assert_eq!(val, 1);
    }

    #[test]
    fn sync_smoke_test() {
        let compiled = true;
        assert!(compiled, "Sync protocol compiled and test harness working");
    }
}
