#![deny(unsafe_code)]

fn main() {
    let _ = std::fs::create_dir_all("../dist");
    tauri_build::build();
}
