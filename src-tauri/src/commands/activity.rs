//! 前面ウィンドウ情報に関する Tauri Command。

use crate::{models::ActiveWindowInfo, platform::windows};

/// 現在の前面ウィンドウ情報を1回分取得する。
///
/// 前面ウィンドウがない瞬間は `Ok(None)`、取得できた場合は `Ok(Some(...))`、
/// Windows APIの失敗は機密値を含まないCommand errorとして返す。
#[tauri::command]
pub fn get_active_window_info() -> Result<Option<ActiveWindowInfo>, String> {
    windows::get_active_window_info().map_err(|error| error.to_string())
}
