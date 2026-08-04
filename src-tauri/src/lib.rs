pub mod commands;
pub mod models;
pub mod platform;
pub mod services;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
