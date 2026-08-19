#![deny(unsafe_code)]

pub mod models;
pub mod ports;
pub mod services;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }
}
