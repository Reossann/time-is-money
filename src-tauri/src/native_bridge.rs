//! Native Messaging Host と Tauri アプリ間の localhost ブリッジ。

use crate::native_messaging::{read_frame, write_frame, NativeMessagingFrameError};
use serde::{Deserialize, Serialize};
use std::io;
use std::net::{TcpListener, TcpStream};
use std::time::Duration;
use tauri::Emitter;

pub const NATIVE_BRIDGE_ADDR: &str = "127.0.0.1:17831";
pub const NATIVE_BRIDGE_EVENT: &str = "native-web-app-change";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeWebAppChange {
    pub url: String,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct NativeBridgeAck {
    pub success: bool,
    pub message: String,
}

impl NativeBridgeAck {
    fn ok(message: impl Into<String>) -> Self {
        Self {
            success: true,
            message: message.into(),
        }
    }

    fn error(message: impl Into<String>) -> Self {
        Self {
            success: false,
            message: message.into(),
        }
    }
}

pub fn forward_native_web_app_change(change: &NativeWebAppChange) -> io::Result<NativeBridgeAck> {
    let mut stream = TcpStream::connect_timeout(
        &NATIVE_BRIDGE_ADDR.parse().unwrap(),
        Duration::from_millis(800),
    )?;
    stream.set_nodelay(true)?;

    let payload = serde_json::to_vec(change).map_err(|error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("serialize native bridge payload failed: {error}"),
        )
    })?;

    write_frame(&mut stream, &payload)?;

    let Some(response_payload) = read_frame(&mut stream).map_err(|error| match error {
        NativeMessagingFrameError::Io(io_error) => io_error,
        NativeMessagingFrameError::MessageTooLarge(message_length) => io::Error::new(
            io::ErrorKind::InvalidData,
            format!("bridge response too large: {message_length}"),
        ),
    })?
    else {
        return Err(io::Error::new(
            io::ErrorKind::UnexpectedEof,
            "bridge response was empty",
        ));
    };

    let ack: NativeBridgeAck = serde_json::from_slice(&response_payload).map_err(|error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("deserialize native bridge ack failed: {error}"),
        )
    })?;

    if ack.success {
        Ok(ack)
    } else {
        Err(io::Error::other(ack.message))
    }
}

pub fn handle_bridge_payload(payload: &[u8]) -> NativeBridgeAck {
    match serde_json::from_slice::<NativeWebAppChange>(payload) {
        Ok(_) => NativeBridgeAck::ok("native web app change accepted"),
        Err(error) => NativeBridgeAck::error(format!("invalid native bridge payload: {error}")),
    }
}

pub fn start_listener(app_handle: tauri::AppHandle) -> io::Result<()> {
    let listener = TcpListener::bind(NATIVE_BRIDGE_ADDR)?;
    listener.set_nonblocking(false)?;

    std::thread::spawn(move || {
        for incoming in listener.incoming() {
            match incoming {
                Ok(mut stream) => {
                    let app_handle = app_handle.clone();
                    std::thread::spawn(move || {
                        if let Err(error) = handle_connection(&app_handle, &mut stream) {
                            eprintln!("Native bridge connection error: {error}");
                        }
                    });
                }
                Err(error) => {
                    eprintln!("Native bridge accept error: {error}");
                    break;
                }
            }
        }
    });

    Ok(())
}

fn handle_connection(app_handle: &tauri::AppHandle, stream: &mut TcpStream) -> io::Result<()> {
    eprintln!("🟢 [Bridge] Connection accepted");

    let Some(payload) = read_frame(stream).map_err(|error| match error {
        NativeMessagingFrameError::Io(io_error) => io_error,
        NativeMessagingFrameError::MessageTooLarge(message_length) => io::Error::new(
            io::ErrorKind::InvalidData,
            format!("bridge request too large: {message_length}"),
        ),
    })?
    else {
        eprintln!("🟡 [Bridge] Empty payload received");
        return Ok(());
    };

    eprintln!("🟢 [Bridge] Payload received, size: {} bytes", payload.len());

    let ack = match serde_json::from_slice::<NativeWebAppChange>(&payload) {
        Ok(change) => {
            eprintln!("🟢 [Bridge] Deserialized change: url={}, timestamp={}", change.url, change.timestamp);
            match app_handle.emit(NATIVE_BRIDGE_EVENT, &change) {
                Ok(()) => {
                    eprintln!("🟢 [Bridge] Event emitted successfully!");
                    NativeBridgeAck::ok("native web app change delivered")
                },
                Err(error) => {
                    eprintln!("🔴 [Bridge] Event emission failed: {}", error);
                    NativeBridgeAck::error(format!("event delivery failed: {error}"))
                },
            }
        },
        Err(error) => {
            eprintln!("🔴 [Bridge] Deserialization failed: {}", error);
            NativeBridgeAck::error(format!("invalid native bridge payload: {error}"))
        }
    };
    return Ok(()); 
}

#[cfg(test)]
mod tests {
    use super::{handle_bridge_payload, NativeBridgeAck, NativeWebAppChange};

    #[test]
    fn accepts_valid_bridge_payload() {
        let payload = serde_json::to_vec(&NativeWebAppChange {
            url: "https://docs.google.com/document/d/example".to_string(),
            timestamp: 1_700_000_000_000,
        })
        .expect("payload should serialize");

        let ack = handle_bridge_payload(&payload);

        assert_eq!(ack, NativeBridgeAck::ok("native web app change accepted"));
    }

    #[test]
    fn rejects_invalid_bridge_payload() {
        let ack = handle_bridge_payload(br#"{"url":123}"#);

        assert!(!ack.success);
        assert!(ack.message.contains("invalid native bridge payload"));
    }
}
