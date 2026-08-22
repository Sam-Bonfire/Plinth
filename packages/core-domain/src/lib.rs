#![forbid(unsafe_code)]

pub mod models;
pub mod ports;
pub mod services;

#[cfg(test)]
mod tests {
    #[test]
    fn it_works() {
        assert_eq!(2 + 2, 4);
    }

    #[test]
    fn domain_smoke_test() {
        assert!(true, "Core domain compiled and test harness working");
    }
}
