#![deny(unsafe_code)]

fn main() {
    println!("PlinthOS POS Terminal Engine");
}

#[cfg(test)]
mod tests {
    #[test]
    fn pos_tauri_init() {
        let val = 1;
        assert_eq!(val, 1);
    }
}
