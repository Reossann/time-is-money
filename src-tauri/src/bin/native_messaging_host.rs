#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = time_is_money::native_messaging::run_host() {
        eprintln!("Native Messaging Host terminated with error: {error}");
        std::process::exit(1);
    }
}
