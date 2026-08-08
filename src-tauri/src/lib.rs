pub mod commands;
pub mod models;
pub mod platform;
pub mod services;

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, WindowEvent,
};
use tauri_plugin_notification::NotificationExt;
use tauri_plugin_store::StoreExt;

use models::settings::AppSettings;
use services::notification_service::{
    notification_delay_from_interval, pick_random_message, NotificationTone,
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
            // 現在は受け取ったURLをログに出力
            println!("ウェブアプリURL受信: {}", url);
            Ok(format!("URLを受け取りました: {}", url))
        }
        Err(e) => Err(format!("URLの解析に失敗しました: {}", e)),
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

fn load_notification_settings(app_handle: &AppHandle) -> AppSettings {
    let store = match app_handle.store("settings.json") {
        Ok(store) => store,
        Err(error) => {
            eprintln!("設定ストアの読み込みに失敗しました: {error}");
            return AppSettings {
                hourly_rate: 3000.0,
                notification_threshold_minutes: 30,
                idle_threshold_minutes: 5,
                notifications_enabled: true,
                notification_tone: None,
                notification_interval_minutes: Some(30),
            };
        }
    };

    match store.get("app-settings") {
        Some(value) => serde_json::from_value::<AppSettings>(value).unwrap_or_else(|error| {
            eprintln!("設定の解析に失敗しました: {error}");
            AppSettings {
                hourly_rate: 3000.0,
                notification_threshold_minutes: 30,
                idle_threshold_minutes: 5,
                notifications_enabled: true,
                notification_tone: None,
                notification_interval_minutes: Some(30),
            }
        }),
        None => AppSettings {
            hourly_rate: 3000.0,
            notification_threshold_minutes: 30,
            idle_threshold_minutes: 5,
            notifications_enabled: true,
            notification_tone: None,
            notification_interval_minutes: Some(30),
        },
    }
}

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::activity::get_active_window_info,
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
                println!("通知ループ開始");
                loop {
                    let settings = load_notification_settings(&app_handle);
                    println!(
                        "通知設定: enabled={}, interval={:?}, tone={:?}",
                        settings.notifications_enabled,
                        settings.notification_interval_minutes,
                        settings.notification_tone
                    );

                    if !settings.notifications_enabled {
                        println!("通知が無効のため待機します");
                        tokio::time::sleep(std::time::Duration::from_secs(60)).await;
                        continue;
                    }

                    let interval = settings.notification_interval_minutes.unwrap_or(30);
                    let tone = NotificationTone::from_setting_value(
                        settings.notification_tone.as_deref().unwrap_or("sparta"),
                    );
                    let delay = notification_delay_from_interval(interval);

                    println!("通知待機開始: {}秒", delay.as_secs());
                    tokio::time::sleep(delay).await;

                    let body = pick_random_message(tone);
                    println!("通知送信試行: {}", body);

                    if let Err(error) = app_handle
                        .notification()
                        .builder()
                        .title("Time Is Money")
                        .body(body)
                        .show()
                    {
                        eprintln!("通知送信に失敗しました: {error}");
                        println!("フォールバック表示: {}", body);
                    } else {
                        println!("通知送信成功");
                    }
                }
            });
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
