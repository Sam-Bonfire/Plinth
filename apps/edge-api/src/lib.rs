#![deny(unsafe_code)]

pub mod db;

#[cfg(test)]
mod tests {
    #[test]
    fn edge_api_init() {
        let val = 1;
        assert_eq!(val, 1);
    }
}
