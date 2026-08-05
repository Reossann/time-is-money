pub mod commands;
pub mod models;
pub mod platform;
pub mod services;

use tauri_plugin_notification::NotificationExt;

/**
 * Chrome拡張機能からのウェブアプリURL情報を受け取るコマンド
 * @param url - ウェブアプリのURL
 * @returns 処理結果
 */
#[tauri::command]
fn receive_web_app_url(url: String) -> Result<String, String> {
    // URL の検証
    if url.is_empty() {
        return Err("URLが空です".to_string());
    }

    // URLの形式確認
    match url::Url::parse(&url) {
        Ok(_) => {
            // ここで後に JavaScript側に通知するイベントを発火させる
            // 現在は受け取ったURLをログに出力
            println!("ウェブアプリURL受信: {}", url);
            Ok(format!("URLを受け取りました: {}", url))
        }
        Err(e) => Err(format!("URLの解析に失敗しました: {}", e)),
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .invoke_handler(tauri::generate_handler![receive_web_app_url])
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
