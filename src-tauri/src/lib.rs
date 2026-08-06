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

const APP_ICON: Image<'_> = tauri::include_image!("icons/icon.png");

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
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            commands::activity::get_active_window_info
        ])
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
