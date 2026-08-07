//! Native Messaging Host のインストール状態を起動時に整えるサービス。

use crate::platform::native_messaging_setup;

pub fn ensure_native_messaging_host_registered() {
    match native_messaging_setup::ensure_registered_from_current_exe() {
        Ok(()) => {}
        Err(error) => {
            eprintln!(
                "Native Messaging Host の自動設定に失敗しました（次回起動時に再試行されます）: {error}"
            );
        }
    }
}
