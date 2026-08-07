//! Native Messaging Host の共通処理。

use serde::Serialize;
use serde_json::Value;
use std::io::{self, Read, Write};
use url::Url;

use crate::native_bridge::{forward_native_web_app_event, NativeWebAppEvent};

pub const MAX_MESSAGE_BYTES: u32 = 256 * 1024;
const MESSAGE_TYPE_URL_CHANGE: &str = "URL_CHANGE";
const MESSAGE_TYPE_TRACKING_STOP: &str = "TRACKING_STOP";
const CODE_OK: &str = "OK";
const CODE_INVALID_JSON: &str = "INVALID_JSON";
const CODE_INVALID_MESSAGE_TYPE: &str = "INVALID_MESSAGE_TYPE";
const CODE_INVALID_URL: &str = "INVALID_URL";
const CODE_MESSAGE_TOO_LARGE: &str = "MESSAGE_TOO_LARGE";
const CODE_INTERNAL_ERROR: &str = "INTERNAL_ERROR";

#[derive(Debug)]
pub enum NativeMessagingFrameError {
    Io(io::Error),
    MessageTooLarge(u32),
}

impl From<io::Error> for NativeMessagingFrameError {
    fn from(error: io::Error) -> Self {
        Self::Io(error)
    }
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeMessagingResponse {
    pub success: bool,
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sanitized_url: Option<String>,
}

impl NativeMessagingResponse {
    fn ok(message: &str, sanitized_url: Option<String>) -> Self {
        Self {
            success: true,
            code: CODE_OK.to_string(),
            message: message.to_string(),
            sanitized_url,
        }
    }

    fn error(code: &str, message: impl Into<String>) -> Self {
        Self {
            success: false,
            code: code.to_string(),
            message: message.into(),
            sanitized_url: None,
        }
    }
}

/// Chrome からの Native Messaging フレームを 1 件読み取る。
///
/// - 先頭 4 バイトは little-endian のメッセージ長
/// - EOF なら `Ok(None)` を返す
pub fn read_frame<R: Read>(reader: &mut R) -> Result<Option<Vec<u8>>, NativeMessagingFrameError> {
    let mut length_bytes = [0_u8; 4];
    let first_read = reader.read(&mut length_bytes[..1])?;

    if first_read == 0 {
        return Ok(None);
    }

    reader.read_exact(&mut length_bytes[1..])?;
    let message_length = u32::from_le_bytes(length_bytes);
    if message_length > MAX_MESSAGE_BYTES {
        return Err(NativeMessagingFrameError::MessageTooLarge(message_length));
    }

    let message_length_usize = usize::try_from(message_length)
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidData, "message length overflow"))?;

    let mut payload = vec![0_u8; message_length_usize];
    reader.read_exact(&mut payload)?;
    Ok(Some(payload))
}

/// Host 応答を Native Messaging フレームとして書き出す。
pub fn write_frame<W: Write>(writer: &mut W, payload: &[u8]) -> io::Result<()> {
    let length = u32::try_from(payload.len())
        .map_err(|_| io::Error::new(io::ErrorKind::InvalidInput, "payload too large"))?;

    writer.write_all(&length.to_le_bytes())?;
    writer.write_all(payload)?;
    writer.flush()?;
    Ok(())
}

fn sanitize_url(raw_url: &str) -> Result<String, String> {
    let mut url = Url::parse(raw_url).map_err(|_| "Only HTTP/HTTPS URLs are allowed")?;

    if url.scheme() != "http" && url.scheme() != "https" {
        return Err("Only HTTP/HTTPS URLs are allowed".to_string());
    }

    let _ = url.set_username("");
    let _ = url.set_password(None);
    url.set_path("/");
    url.set_query(None);
    url.set_fragment(None);

    Ok(url.to_string())
}

fn build_error_response(code: &str, message: impl Into<String>) -> NativeMessagingResponse {
    NativeMessagingResponse::error(code, message)
}

/// 受信した JSON を検証して、Host 応答を返す。
pub fn handle_message(raw_payload: &[u8]) -> NativeMessagingResponse {
    if raw_payload.len() > usize::try_from(MAX_MESSAGE_BYTES).unwrap_or(usize::MAX) {
        return build_error_response(
            CODE_MESSAGE_TOO_LARGE,
            format!("Message exceeds {} bytes", MAX_MESSAGE_BYTES),
        );
    }

    let value: Value = match serde_json::from_slice(raw_payload) {
        Ok(value) => value,
        Err(error) => {
            return build_error_response(
                CODE_INVALID_JSON,
                format!("Invalid JSON payload: {error}"),
            )
        }
    };

    let Some(object) = value.as_object() else {
        return build_error_response(CODE_INVALID_JSON, "Message must be a JSON object");
    };

    let message_type = object.get("type").and_then(Value::as_str);
    if message_type != Some(MESSAGE_TYPE_URL_CHANGE)
        && message_type != Some(MESSAGE_TYPE_TRACKING_STOP)
    {
        return build_error_response(
            CODE_INVALID_MESSAGE_TYPE,
            format!(
                "Unsupported message type: {}",
                message_type.unwrap_or("<missing>")
            ),
        );
    }

    let Some(timestamp_value) = object.get("timestamp") else {
        return build_error_response(CODE_INVALID_JSON, "timestamp must be present");
    };

    if !timestamp_value.is_number() {
        return build_error_response(CODE_INVALID_JSON, "timestamp must be numeric");
    }

    let Some(timestamp) = timestamp_value.as_u64() else {
        return build_error_response(
            CODE_INVALID_JSON,
            "timestamp must be a non-negative integer",
        );
    };

    if timestamp == 0 {
        return build_error_response(CODE_INVALID_JSON, "timestamp must be greater than zero");
    }

    if message_type == Some(MESSAGE_TYPE_TRACKING_STOP) {
        return NativeMessagingResponse::ok("Tracking stop accepted", None);
    }

    let Some(url_value) = object.get("url").and_then(Value::as_str) else {
        return build_error_response(CODE_INVALID_URL, "URL must be a string");
    };

    let sanitized_url = match sanitize_url(url_value) {
        Ok(sanitized_url) => sanitized_url,
        Err(message) => return build_error_response(CODE_INVALID_URL, message),
    };

    NativeMessagingResponse::ok("URL accepted", Some(sanitized_url))
}

fn bridge_event_from_payload(
    payload: &[u8],
    sanitized_url: Option<String>,
) -> Option<NativeWebAppEvent> {
    let value = serde_json::from_slice::<Value>(payload).ok()?;
    let message_type = value.get("type")?.as_str()?;
    let timestamp = value.get("timestamp")?.as_u64()?;

    match message_type {
        MESSAGE_TYPE_URL_CHANGE => Some(NativeWebAppEvent::UrlChange {
            url: sanitized_url?,
            timestamp,
        }),
        MESSAGE_TYPE_TRACKING_STOP => Some(NativeWebAppEvent::TrackingStop { timestamp }),
        _ => None,
    }
}

/// Native Messaging Host のメインループ。
pub fn run_host() -> io::Result<()> {
    let stdin = io::stdin();
    let stdout = io::stdout();
    let stderr = io::stderr();

    run_host_with_io(stdin.lock(), stdout.lock(), stderr.lock())
}

pub fn run_host_with_io<R: Read, W: Write, E: Write>(
    mut reader: R,
    mut writer: W,
    mut error_writer: E,
) -> io::Result<()> {
    let payload = match read_frame(&mut reader) {
        Ok(Some(payload)) => payload,
        Ok(None) => return Ok(()),
        Err(NativeMessagingFrameError::MessageTooLarge(message_length)) => {
            let response = NativeMessagingResponse::error(
                CODE_MESSAGE_TOO_LARGE,
                format!(
                    "Message exceeds {} bytes (received {})",
                    MAX_MESSAGE_BYTES, message_length
                ),
            );
            let response_bytes = serde_json::to_vec(&response).map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("serialize response failed: {error}"),
                )
            })?;

            write_frame(&mut writer, &response_bytes)?;
            let _ = writeln!(
                error_writer,
                "Native Messaging Host rejected oversized frame: {message_length} bytes"
            );
            return Ok(());
        }
        Err(NativeMessagingFrameError::Io(error))
            if error.kind() == io::ErrorKind::UnexpectedEof =>
        {
            let response = NativeMessagingResponse::error(
                CODE_INVALID_JSON,
                "Incomplete Native Messaging frame",
            );
            let response_bytes = serde_json::to_vec(&response).map_err(|serialize_error| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("serialize response failed: {serialize_error}"),
                )
            })?;

            write_frame(&mut writer, &response_bytes)?;
            let _ = writeln!(
                error_writer,
                "Native Messaging Host received incomplete frame"
            );
            return Ok(());
        }
        Err(NativeMessagingFrameError::Io(error)) => return Err(error),
    };

    let response = handle_message(&payload);
    if response.success {
        let Some(bridge_event) =
            bridge_event_from_payload(&payload, response.sanitized_url.clone())
        else {
            let response = NativeMessagingResponse::error(
                CODE_INTERNAL_ERROR,
                "Could not create native bridge event",
            );
            let response_bytes = serde_json::to_vec(&response).map_err(|error| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("serialize response failed: {error}"),
                )
            })?;
            write_frame(&mut writer, &response_bytes)?;
            return Ok(());
        };

        if let Err(error) = forward_native_web_app_event(&bridge_event) {
            let response = NativeMessagingResponse::error(
                "APP_UNAVAILABLE",
                format!("Tauri app bridge unavailable: {error}"),
            );
            let response_bytes = serde_json::to_vec(&response).map_err(|serialize_error| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("serialize response failed: {serialize_error}"),
                )
            })?;

            write_frame(&mut writer, &response_bytes)?;
            let _ = writeln!(
                error_writer,
                "Native Messaging Host could not deliver to Tauri app: {error}"
            );

            return Ok(());
        }
    }
    let response_bytes = match serde_json::to_vec(&response) {
        Ok(bytes) => bytes,
        Err(error) => {
            let fallback = NativeMessagingResponse::error(
                CODE_INTERNAL_ERROR,
                format!("serialize response failed: {error}"),
            );

            serde_json::to_vec(&fallback).map_err(|fallback_error| {
                io::Error::new(
                    io::ErrorKind::InvalidData,
                    format!("serialize fallback response failed: {fallback_error}"),
                )
            })?
        }
    };

    if let Err(error) = write_frame(&mut writer, &response_bytes) {
        let _ = writeln!(
            error_writer,
            "Native Messaging Host failed to write response: {error}"
        );
        return Err(error);
    }

    let _ = writeln!(
        error_writer,
        "Native Messaging Host processed message with code {}",
        response.code
    );

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn encode_message(payload: &[u8]) -> Vec<u8> {
        let mut frame = Vec::new();
        frame.extend_from_slice(&(payload.len() as u32).to_le_bytes());
        frame.extend_from_slice(payload);
        frame
    }

    #[test]
    fn handles_valid_message() {
        let response = handle_message(
            br#"{"type":"URL_CHANGE","url":"https://user:pass@docs.google.com/document/d/example?usp=sharing#heading","timestamp":1700000000000}"#,
        );

        assert!(response.success);
        assert_eq!(response.code, CODE_OK);
        assert_eq!(
            response.sanitized_url.as_deref(),
            Some("https://docs.google.com/")
        );
    }

    #[test]
    fn handles_tracking_stop_message() {
        let response = handle_message(br#"{"type":"TRACKING_STOP","timestamp":1700000000000}"#);

        assert!(response.success);
        assert_eq!(response.code, CODE_OK);
        assert_eq!(response.sanitized_url, None);
    }

    #[test]
    fn builds_tracking_stop_bridge_event() {
        let event = bridge_event_from_payload(
            br#"{"type":"TRACKING_STOP","timestamp":1700000000000}"#,
            None,
        );

        assert_eq!(
            event,
            Some(NativeWebAppEvent::TrackingStop {
                timestamp: 1_700_000_000_000,
            })
        );
    }

    #[test]
    fn rejects_invalid_json() {
        let response = handle_message(br#"{"#);

        assert!(!response.success);
        assert_eq!(response.code, CODE_INVALID_JSON);
    }

    #[test]
    fn rejects_unknown_type() {
        let response =
            handle_message(br#"{"type":"UNKNOWN","url":"https://example.com","timestamp":1}"#);

        assert_eq!(response.code, CODE_INVALID_MESSAGE_TYPE);
    }

    #[test]
    fn rejects_non_http_url() {
        let response =
            handle_message(br#"{"type":"URL_CHANGE","url":"chrome://extensions/","timestamp":1}"#);

        assert_eq!(response.code, CODE_INVALID_URL);
    }

    #[test]
    fn rejects_oversized_payload() {
        let payload = vec![b'a'; usize::try_from(MAX_MESSAGE_BYTES).unwrap() + 1];
        let response = handle_message(&payload);

        assert_eq!(response.code, CODE_MESSAGE_TOO_LARGE);
    }

    #[test]
    fn read_frame_round_trips_one_message() {
        let payload = b"hello";
        let mut cursor = Cursor::new(encode_message(payload));

        let result = read_frame(&mut cursor).unwrap();

        assert_eq!(result.as_deref(), Some(payload.as_ref()));
    }

    #[test]
    fn write_frame_prefixes_length() {
        let mut writer = Vec::new();

        write_frame(&mut writer, b"{}\n").unwrap();

        assert_eq!(&writer[..4], &3_u32.to_le_bytes());
        assert_eq!(&writer[4..], b"{}\n");
    }

    #[test]
    fn run_host_with_io_reports_when_tauri_app_is_unavailable() {
        let input = encode_message(
            br#"{"type":"URL_CHANGE","url":"https://example.com/?q=1#x","timestamp":1}"#,
        );
        let mut output = Vec::new();
        let mut logs = Vec::new();

        run_host_with_io(Cursor::new(input), &mut output, &mut logs).unwrap();

        let response_length = u32::from_le_bytes(output[0..4].try_into().unwrap()) as usize;
        let response = serde_json::from_slice::<Value>(&output[4..4 + response_length]).unwrap();

        assert_eq!(response["success"], false);
        assert_eq!(response["code"], "APP_UNAVAILABLE");
        assert!(response["message"]
            .as_str()
            .expect("response should contain a message")
            .contains("Tauri app bridge unavailable"));
        assert!(String::from_utf8(logs)
            .unwrap()
            .contains("could not deliver to Tauri app"));
    }

    #[test]
    fn run_host_with_io_rejects_oversized_frame_length() {
        let mut input = Vec::new();
        input.extend_from_slice(&(MAX_MESSAGE_BYTES + 1).to_le_bytes());
        let mut output = Vec::new();
        let mut logs = Vec::new();

        run_host_with_io(Cursor::new(input), &mut output, &mut logs).unwrap();

        let response_length = u32::from_le_bytes(output[0..4].try_into().unwrap()) as usize;
        let response = serde_json::from_slice::<Value>(&output[4..4 + response_length]).unwrap();

        assert_eq!(response["success"], false);
        assert_eq!(response["code"], CODE_MESSAGE_TOO_LARGE);
        assert!(String::from_utf8(logs).unwrap().contains("oversized frame"));
    }

    #[test]
    fn run_host_with_io_rejects_incomplete_frame() {
        let mut input = Vec::new();
        input.extend_from_slice(&5_u32.to_le_bytes());
        input.extend_from_slice(b"ab");
        let mut output = Vec::new();
        let mut logs = Vec::new();

        run_host_with_io(Cursor::new(input), &mut output, &mut logs).unwrap();

        let response_length = u32::from_le_bytes(output[0..4].try_into().unwrap()) as usize;
        let response = serde_json::from_slice::<Value>(&output[4..4 + response_length]).unwrap();

        assert_eq!(response["success"], false);
        assert_eq!(response["code"], CODE_INVALID_JSON);
        assert!(String::from_utf8(logs)
            .unwrap()
            .contains("incomplete frame"));
    }
}
