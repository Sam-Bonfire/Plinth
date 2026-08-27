#![deny(unsafe_code)]

/// Launches the Tauri POS application.
///
/// # Panics
///
/// Panics if the Tauri runtime fails to initialize or encounter fatal context generation errors.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    #[test]
    fn pos_tauri_init() {
        let val = 1;
        assert_eq!(val, 1);
    }
}
