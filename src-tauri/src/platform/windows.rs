//! Windows の前面ウィンドウ情報を取得するモジュール。

use std::fmt;

use windows::{
    core::PWSTR,
    Win32::{
        Foundation::{
            CloseHandle, GetLastError, SetLastError, ERROR_INSUFFICIENT_BUFFER, ERROR_INVALID_DATA,
            ERROR_NO_UNICODE_TRANSLATION, ERROR_SUCCESS, HANDLE, HWND,
        },
        System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32,
            PROCESS_QUERY_LIMITED_INFORMATION,
        },
        UI::WindowsAndMessaging::{
            GetForegroundWindow, GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
        },
    },
};

use crate::models::ActiveWindowInfo;

const INITIAL_PROCESS_PATH_CAPACITY: usize = 260;
const MAX_UTF16_BUFFER_CAPACITY: usize = 32_768;

/// 前面ウィンドウ情報の取得に失敗したことを表す安全なエラー。
///
/// ウィンドウタイトルや実行ファイルのフルパスは保持せず、
/// 失敗した Windows API と OS エラーコードだけを公開する。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ActiveWindowError {
    operation: &'static str,
    code: u32,
}

impl ActiveWindowError {
    const fn new(operation: &'static str, code: u32) -> Self {
        Self { operation, code }
    }

    /// 失敗した処理名を返す。
    pub const fn operation(&self) -> &'static str {
        self.operation
    }

    /// Windows のエラーコードを返す。
    pub const fn code(&self) -> u32 {
        self.code
    }
}

impl fmt::Display for ActiveWindowError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(
            formatter,
            "{} failed with OS error code {}",
            self.operation, self.code
        )
    }
}

impl std::error::Error for ActiveWindowError {}

/// 現在の前面ウィンドウからプロセス名、タイトル、PID を取得する。
///
/// Windows が前面ウィンドウを一時的に持たない場合は `Ok(None)` を返す。
pub fn get_active_window_info() -> Result<Option<ActiveWindowInfo>, ActiveWindowError> {
    let Some(window) = api::foreground_window() else {
        return Ok(None);
    };

    let process_id = api::window_process_id(window)?;
    let process = OwnedProcessHandle::open(process_id)?;
    let process_path = api::process_image_path(process.raw())?;
    let process_name = process_name_from_path(&process_path)?;
    let window_title = api::window_title(window)?;

    Ok(Some(ActiveWindowInfo {
        process_name,
        window_title,
        process_id,
    }))
}

struct OwnedProcessHandle(HANDLE);

impl OwnedProcessHandle {
    fn open(process_id: u32) -> Result<Self, ActiveWindowError> {
        api::open_process(process_id).map(Self)
    }

    const fn raw(&self) -> HANDLE {
        self.0
    }
}

impl Drop for OwnedProcessHandle {
    fn drop(&mut self) {
        api::close_handle(self.0);
    }
}

fn decode_utf16(operation: &'static str, value: &[u16]) -> Result<String, ActiveWindowError> {
    String::from_utf16(value)
        .map_err(|_| ActiveWindowError::new(operation, ERROR_NO_UNICODE_TRANSLATION.0))
}

fn process_name_from_path(path: &str) -> Result<String, ActiveWindowError> {
    path.rsplit(['\\', '/'])
        .next()
        .filter(|name| !name.is_empty())
        .map(ToOwned::to_owned)
        .ok_or_else(|| ActiveWindowError::new("process name extraction", ERROR_INVALID_DATA.0))
}

fn next_buffer_capacity(current: usize) -> Option<usize> {
    let next = current.saturating_mul(2).min(MAX_UTF16_BUFFER_CAPACITY);
    (next > current).then_some(next)
}

fn initial_window_title_capacity(title_length: usize) -> Option<usize> {
    let required_capacity = title_length.checked_add(1)?;
    if required_capacity > MAX_UTF16_BUFFER_CAPACITY {
        return None;
    }

    // Reserve one extra code unit beyond the required null terminator so an
    // unchanged title is distinguishable from a buffer-filling read.
    Some(
        required_capacity
            .saturating_add(1)
            .min(MAX_UTF16_BUFFER_CAPACITY),
    )
}

mod api {
    use super::*;

    pub(super) fn foreground_window() -> Option<HWND> {
        // SAFETY: GetForegroundWindow does not dereference application-provided pointers.
        let window = unsafe { GetForegroundWindow() };
        (!window.is_invalid()).then_some(window)
    }

    pub(super) fn window_process_id(window: HWND) -> Result<u32, ActiveWindowError> {
        let mut process_id = 0;
        clear_last_error();

        // SAFETY: process_id points to writable memory for the duration of this call.
        let thread_id = unsafe { GetWindowThreadProcessId(window, Some(&mut process_id)) };
        if thread_id == 0 || process_id == 0 {
            return Err(last_error_or(
                "GetWindowThreadProcessId",
                ERROR_INVALID_DATA.0,
            ));
        }

        Ok(process_id)
    }

    pub(super) fn open_process(process_id: u32) -> Result<HANDLE, ActiveWindowError> {
        // SAFETY: OpenProcess receives a PID supplied by Windows and creates a new owned handle.
        unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, process_id) }
            .map_err(|error| ActiveWindowError::new("OpenProcess", windows_error_code(&error)))
    }

    pub(super) fn close_handle(handle: HANDLE) {
        // SAFETY: OwnedProcessHandle calls this exactly once for the handle returned by OpenProcess.
        let _ = unsafe { CloseHandle(handle) };
    }

    pub(super) fn process_image_path(handle: HANDLE) -> Result<String, ActiveWindowError> {
        let mut capacity = INITIAL_PROCESS_PATH_CAPACITY;

        loop {
            let mut buffer = vec![0_u16; capacity];
            let mut length = capacity as u32;

            // SAFETY: buffer is writable for `length` UTF-16 code units and remains alive
            // throughout the call. QueryFullProcessImageNameW updates length to the used size.
            let result = unsafe {
                QueryFullProcessImageNameW(
                    handle,
                    PROCESS_NAME_WIN32,
                    PWSTR(buffer.as_mut_ptr()),
                    &mut length,
                )
            };

            let error = match result {
                Ok(()) => {
                    return decode_utf16("QueryFullProcessImageNameW", &buffer[..length as usize])
                }
                Err(error) => error,
            };

            let error_code = windows_error_code(&error);
            if error_code == ERROR_INSUFFICIENT_BUFFER.0 {
                if let Some(next) = next_buffer_capacity(capacity) {
                    capacity = next;
                    continue;
                }
            }

            return Err(ActiveWindowError::new(
                "QueryFullProcessImageNameW",
                nonzero_or(error_code, ERROR_INVALID_DATA.0),
            ));
        }
    }

    pub(super) fn window_title(window: HWND) -> Result<String, ActiveWindowError> {
        let title_length = window_title_length(window)?;
        if title_length == 0 {
            return Ok(String::new());
        }

        let Some(mut capacity) = initial_window_title_capacity(title_length) else {
            return Err(ActiveWindowError::new(
                "GetWindowTextW",
                ERROR_INSUFFICIENT_BUFFER.0,
            ));
        };
        let mut retried_at_max_capacity = false;

        loop {
            let mut buffer = vec![0_u16; capacity];
            clear_last_error();

            // SAFETY: buffer is valid writable memory and the windows crate passes its length.
            let copied = unsafe { GetWindowTextW(window, &mut buffer) };
            if copied == 0 {
                let error_code = last_error_code();
                return if error_code == ERROR_SUCCESS.0 {
                    Ok(String::new())
                } else {
                    Err(ActiveWindowError::new("GetWindowTextW", error_code))
                };
            }

            let copied = copied as usize;
            if copied < capacity - 1 {
                return decode_utf16("GetWindowTextW", &buffer[..copied]);
            }

            if let Some(next) = next_buffer_capacity(capacity) {
                capacity = next;
                continue;
            }

            // A copied length of capacity - 1 can mean either a complete title
            // or truncation. At the hard limit, confirm against the latest length.
            let latest_length = window_title_length(window)?;
            if latest_length == copied {
                return decode_utf16("GetWindowTextW", &buffer[..copied]);
            }
            if latest_length < copied && !retried_at_max_capacity {
                retried_at_max_capacity = true;
                continue;
            }

            return Err(ActiveWindowError::new(
                "GetWindowTextW",
                ERROR_INSUFFICIENT_BUFFER.0,
            ));
        }
    }

    fn window_title_length(window: HWND) -> Result<usize, ActiveWindowError> {
        clear_last_error();

        // SAFETY: window is the HWND returned by GetForegroundWindow.
        let title_length = unsafe { GetWindowTextLengthW(window) };
        if title_length == 0 {
            let error_code = last_error_code();
            return if error_code == ERROR_SUCCESS.0 {
                Ok(0)
            } else {
                Err(ActiveWindowError::new("GetWindowTextLengthW", error_code))
            };
        }

        Ok(title_length as usize)
    }

    fn clear_last_error() {
        // SAFETY: SetLastError only updates thread-local OS state.
        unsafe { SetLastError(ERROR_SUCCESS) };
    }

    fn last_error_code() -> u32 {
        // SAFETY: GetLastError only reads thread-local OS state.
        unsafe { GetLastError().0 }
    }

    fn last_error_or(operation: &'static str, fallback: u32) -> ActiveWindowError {
        ActiveWindowError::new(operation, nonzero_or(last_error_code(), fallback))
    }

    pub(super) fn windows_error_code(error: &windows::core::Error) -> u32 {
        const HRESULT_FROM_WIN32_PREFIX: u32 = 0x8007_0000;

        let code = error.code().0 as u32;
        let code = if code & 0xFFFF_0000 == HRESULT_FROM_WIN32_PREFIX {
            code & 0x0000_FFFF
        } else {
            code
        };

        nonzero_or(code, ERROR_INVALID_DATA.0)
    }

    const fn nonzero_or(value: u32, fallback: u32) -> u32 {
        if value == 0 {
            fallback
        } else {
            value
        }
    }
}

#[cfg(test)]
mod tests {
    use std::{thread, time::Duration};

    use super::*;

    #[test]
    fn decodes_unicode_utf16() {
        let encoded: Vec<u16> = "前面ウィンドウ🚀".encode_utf16().collect();

        assert_eq!(
            decode_utf16("test UTF-16", &encoded).expect("valid UTF-16 should decode"),
            "前面ウィンドウ🚀"
        );
    }

    #[test]
    fn decodes_empty_utf16() {
        assert_eq!(
            decode_utf16("test UTF-16", &[]).expect("empty UTF-16 should decode"),
            ""
        );
    }

    #[test]
    fn rejects_invalid_utf16_without_exposing_input() {
        let error = decode_utf16("test UTF-16", &[0xD800])
            .expect_err("an unpaired surrogate should be rejected");

        assert_eq!(error.operation(), "test UTF-16");
        assert_eq!(error.code(), ERROR_NO_UNICODE_TRANSLATION.0);
        assert!(!error.to_string().contains("D800"));
    }

    #[test]
    fn decodes_long_unicode_utf16() {
        let expected = "長いタイトル🚀".repeat(4_096);
        let encoded: Vec<u16> = expected.encode_utf16().collect();

        assert_eq!(
            decode_utf16("test UTF-16", &encoded).expect("long UTF-16 should decode"),
            expected
        );
    }

    #[test]
    fn extracts_process_name_from_windows_path() {
        assert_eq!(
            process_name_from_path(r"C:\Program Files\Example\app.exe")
                .expect("Windows path should contain a process name"),
            "app.exe"
        );
    }

    #[test]
    fn extracts_unicode_process_name_from_forward_slash_path() {
        assert_eq!(
            process_name_from_path("C:/アプリ/時計.exe")
                .expect("forward slash path should contain a process name"),
            "時計.exe"
        );
    }

    #[test]
    fn extracts_process_name_from_long_unicode_path() {
        let directory = "長いディレクトリ".repeat(100);
        let path = format!(r"C:\{directory}\long-process.exe");

        assert_eq!(
            process_name_from_path(&path).expect("long path should contain a process name"),
            "long-process.exe"
        );
    }

    #[test]
    fn rejects_path_without_process_name() {
        let error = process_name_from_path(r"C:\Program Files\Example\")
            .expect_err("a trailing separator has no process name");

        assert_eq!(error.operation(), "process name extraction");
        assert_eq!(error.code(), ERROR_INVALID_DATA.0);
        assert!(!error.to_string().contains("Program Files"));
    }

    #[test]
    fn grows_buffer_up_to_the_limit() {
        assert_eq!(next_buffer_capacity(260), Some(520));
        assert_eq!(
            next_buffer_capacity(MAX_UTF16_BUFFER_CAPACITY - 1),
            Some(MAX_UTF16_BUFFER_CAPACITY)
        );
        assert_eq!(next_buffer_capacity(MAX_UTF16_BUFFER_CAPACITY), None);
    }

    #[test]
    fn reserves_window_title_headroom_up_to_the_limit() {
        assert_eq!(initial_window_title_capacity(10), Some(12));
        assert_eq!(
            initial_window_title_capacity(MAX_UTF16_BUFFER_CAPACITY - 2),
            Some(MAX_UTF16_BUFFER_CAPACITY)
        );
        assert_eq!(
            initial_window_title_capacity(MAX_UTF16_BUFFER_CAPACITY - 1),
            Some(MAX_UTF16_BUFFER_CAPACITY)
        );
        assert_eq!(
            initial_window_title_capacity(MAX_UTF16_BUFFER_CAPACITY),
            None
        );
    }

    #[test]
    fn error_display_contains_only_operation_and_code() {
        let error = ActiveWindowError::new("OpenProcess", 5);

        assert_eq!(error.to_string(), "OpenProcess failed with OS error code 5");
    }

    #[test]
    fn converts_hresult_from_win32_back_to_os_error_code() {
        let error = windows::core::Error::from_hresult(windows::core::HRESULT::from_win32(
            ERROR_INSUFFICIENT_BUFFER.0,
        ));

        assert_eq!(api::windows_error_code(&error), ERROR_INSUFFICIENT_BUFFER.0);
    }

    #[test]
    #[ignore = "requires an interactive Windows desktop"]
    fn reads_foreground_window_from_interactive_desktop() {
        let mut last_error = None;

        for _ in 0..5 {
            match get_active_window_info() {
                Ok(Some(info)) => {
                    assert!(info.process_id > 0);
                    assert!(!info.process_name.is_empty());
                    let _: &str = &info.window_title;
                    return;
                }
                Ok(None) => {}
                Err(error) => last_error = Some(error),
            }

            thread::sleep(Duration::from_millis(100));
        }

        panic!(
            "foreground window information was unavailable{}",
            last_error
                .map(|error| format!(" ({error})"))
                .unwrap_or_default()
        );
    }
}
