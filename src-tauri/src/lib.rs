pub mod commands;
pub mod models;
pub mod platform;
pub mod services;

use tauri_plugin_notification::NotificationExt;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let app_handle = app.handle().clone();
            // バックグラウンドでタイマーを動かす
            tauri::async_runtime::spawn(async move {
                // 60秒待つ（この数字を変えると通知タイミングが変わる）
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                app_handle
                    .notification()
                    .builder()
                    .title("Time Is Money")
                    .body("アプリを起動して1分が経ちました")
                    .show()
                    .ok();
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
