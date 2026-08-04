pub mod commands;
pub mod models;
pub mod platform;
pub mod services;

use tauri_plugin_notification::NotificationExt;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            #[cfg(desktop)]
            {
                use tauri_plugin_autostart::MacosLauncher;

                app.handle().plugin(tauri_plugin_autostart::init(
                    MacosLauncher::LaunchAgent,
                    None,
                ))?;
            }

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // TODO: 活動計測が実装されたら、固定60秒ではなく実際の通知条件に接続する。
                tokio::time::sleep(std::time::Duration::from_secs(60)).await;

                if let Err(error) = app_handle
                    .notification()
                    .builder()
                    .title("Time Is Money")
                    .body("アプリを起動して1分が経ちました")
                    .show()
                {
                    eprintln!("通知送信に失敗しました: {error}");
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
