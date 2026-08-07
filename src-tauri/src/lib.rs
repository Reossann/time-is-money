pub mod commands;
pub mod models;
pub mod native_bridge;
pub mod native_messaging;
pub mod platform;
pub mod services;

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;

use services::{
    app_usage_tracker::AppUsageTracker,
    notification_service::{pick_random_message, DEFAULT_TONE},
};

const APP_ICON: Image<'_> = tauri::include_image!("icons/icon.png");

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
            // URL本体はログやCommand戻り値へ出さない。
            Ok("URLを受け取りました".to_string())
        }
        Err(_) => Err("URLの解析に失敗しました".to_string()),
    }
}

fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(error) = window.unminimize() {
            eprintln!("ウィンドウの最小化解除に失敗しました: {error}");
        }
        if let Err(error) = window.show() {
            eprintln!("ウィンドウの表示に失敗しました: {error}");
        }
        if let Err(error) = window.set_focus() {
            eprintln!("ウィンドウを前面に表示できませんでした: {error}");
        }
    } else {
        eprintln!("メインウィンドウが見つかりませんでした");
    }
}

pub fn run() {
    let app_usage_tracker = AppUsageTracker::for_current_process()
        .expect("前面アプリ利用時間trackerを初期化できませんでした");

    tauri::Builder::default()
        .manage(app_usage_tracker)
        .manage(native_bridge::NativeBridgeState::default())
        .invoke_handler(tauri::generate_handler![
            commands::activity::get_active_window_info,
            commands::activity::start_app_usage_tracking,
            commands::activity::get_app_usage_tracking_snapshot,
            commands::activity::stop_app_usage_tracking,
            native_bridge::get_latest_native_web_app_event,
            receive_web_app_url
        ])
        .plugin(tauri_plugin_store::Builder::new().build())
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

            services::native_bridge_service::start_native_bridge_listener(app.handle().clone());
            services::native_messaging_setup_service::ensure_native_messaging_host_registered();

            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Err(error) = window_clone.hide() {
                            eprintln!("ウィンドウの非表示に失敗しました: {error}");
                        }
                    }
                });
            } else {
                eprintln!("メインウィンドウが見つかりませんでした");
            }

            let open_item = MenuItemBuilder::new("開く").id("open").build(app)?;

            let quit_item = MenuItemBuilder::new("終了").id("quit").build(app)?;

            let menu = MenuBuilder::new(app)
                .item(&open_item)
                .item(&quit_item)
                .build()?;

            TrayIconBuilder::new()
                .icon(APP_ICON)
                .tooltip("Time Is Money")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => show_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        show_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                // TODO: 活動計測が実装されたら、固定タイマーではなく実際の通知条件に接続する。（動作確認用に5秒に変更）
                tokio::time::sleep(std::time::Duration::from_secs(5)).await;

                let body = pick_random_message(DEFAULT_TONE);

                if let Err(error) = app_handle
                    .notification()
                    .builder()
                    .title("Time Is Money")
                    .body(body)
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

#[cfg(test)]
mod tests {
    use super::receive_web_app_url;

    #[test]
    fn receive_web_app_url_does_not_echo_the_full_url() {
        let url = "https://example.com/private-path?token=secret";
        let result = receive_web_app_url(url.to_owned()).unwrap();

        assert_eq!(result, "URLを受け取りました");
        assert!(!result.contains("example.com"));
        assert!(!result.contains("private-path"));
    }

    #[test]
    fn receive_web_app_url_hides_invalid_url_details() {
        let raw_url = "not a valid URL with private-token";

        let error = receive_web_app_url(raw_url.to_string()).expect_err("invalid URL must fail");

        assert_eq!(error, "URLの解析に失敗しました");
        assert!(!error.contains("private-token"));
    }
}
