//! Native Messaging Host からのイベントを Tauri フロントへ橋渡しするサービス。

use crate::native_bridge;
use tauri::AppHandle;

pub fn start_native_bridge_listener(app_handle: AppHandle) {
    if let Err(error) = native_bridge::start_listener(app_handle) {
        eprintln!("Native bridge listener failed to start: {error}");
    }
}
