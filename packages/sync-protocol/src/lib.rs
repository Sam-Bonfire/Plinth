#![deny(unsafe_code)]

#[cfg(test)]
mod tests {
    #[test]
    fn sync_protocol_init() {
        let val = 1;
        assert_eq!(val, 1);
    }
}
