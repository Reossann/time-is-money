pub mod commands;
pub mod models;
pub mod platform;
pub mod services;

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager,
    WindowEvent,
};

const APP_ICON: Image<'_> = tauri::include_image!("icons/icon.png");

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // ウィンドウの×ボタンを押したときの動作を変更する
            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        // 終了せずに非表示にする
                        api.prevent_close();
                        if let Err(e) = window_clone.hide() {
                            eprintln!("ウィンドウの非表示に失敗しました: {}", e);
                        }
                    }
                });
            } else {
                eprintln!("メインウィンドウが見つかりませんでした");
            }

            // 「開く」メニュー項目を作成する
            let open_item = MenuItemBuilder::new("開く")
                .id("open")
                .build(app)
                .expect("「開く」メニュー項目の作成に失敗しました");

            // 「終了」メニュー項目を作成する
            let quit_item = MenuItemBuilder::new("終了")
                .id("quit")
                .build(app)
                .expect("「終了」メニュー項目の作成に失敗しました");

            // メニューを組み立てる
            let menu = MenuBuilder::new(app)
                .item(&open_item)
                .item(&quit_item)
                .build()
                .expect("トレイメニューの作成に失敗しました");

            // トレイアイコンを作成して表示する
            TrayIconBuilder::new()
                .icon(APP_ICON)
                .tooltip("Time Is Money")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "open" => {
                        // 「開く」を押したらウィンドウを表示する
                        if let Some(window) = app.get_webview_window("main") {
                            if let Err(e) = window.show() {
                                eprintln!("ウィンドウの表示に失敗しました: {}", e);
                            }
                        } else {
                            eprintln!("メインウィンドウが見つかりませんでした");
                        }
                    }
                    "quit" => {
                        // 「終了」を押したらアプリを終了する
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)
                .expect("トレイアイコンの作成に失敗しました");

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Tauri アプリの起動に失敗しました");
}
