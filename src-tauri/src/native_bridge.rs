//! Native Messaging Host と Tauri アプリ間の localhost ブリッジ。

use crate::native_messaging::{read_frame, write_frame, NativeMessagingFrameError};
use serde::{Deserialize, Serialize};
use std::io;
use std::net::{TcpListener, TcpStream};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Emitter, Manager, State};

pub const NATIVE_BRIDGE_ADDR: &str = "127.0.0.1:17831";
pub const NATIVE_BRIDGE_EVENT: &str = "native-web-app-change";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type")]
pub enum NativeWebAppEvent {
    #[serde(rename = "URL_CHANGE")]
    UrlChange { url: String, timestamp: u64 },
    #[serde(rename = "TRACKING_STOP")]
    TrackingStop { timestamp: u64 },
}

#[derive(Default)]
pub struct NativeBridgeState {
    latest_event: Mutex<Option<NativeWebAppEvent>>,
}

impl NativeBridgeState {
    fn record(&self, event: NativeWebAppEvent) -> Result<(), String> {
        let mut latest_event = self
            .latest_event
            .lock()
            .map_err(|_| "native bridge state lock failed".to_string())?;
        *latest_event = Some(event);
        Ok(())
    }

    fn latest(&self) -> Result<Option<NativeWebAppEvent>, String> {
        self.latest_event
            .lock()
            .map(|event| event.clone())
            .map_err(|_| "native bridge state lock failed".to_string())
    }
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

pub fn forward_native_web_app_event(event: &NativeWebAppEvent) -> io::Result<NativeBridgeAck> {
    let mut stream = TcpStream::connect_timeout(
        &NATIVE_BRIDGE_ADDR.parse().unwrap(),
        Duration::from_millis(800),
    )?;
    stream.set_nodelay(true)?;

    let payload = serde_json::to_vec(event).map_err(|error| {
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
    match serde_json::from_slice::<NativeWebAppEvent>(payload) {
        Ok(_) => NativeBridgeAck::ok("native web app event accepted"),
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

    let ack = match serde_json::from_slice::<NativeWebAppEvent>(&payload) {
        Ok(event) => {
            let state = app_handle.state::<NativeBridgeState>();
            match state.record(event.clone()) {
                Ok(()) => match app_handle.emit(NATIVE_BRIDGE_EVENT, &event) {
                    Ok(()) => NativeBridgeAck::ok("native web app event delivered"),
                    Err(error) => NativeBridgeAck::error(format!("event delivery failed: {error}")),
                },
                Err(error) => NativeBridgeAck::error(error),
            }
        }
        Err(error) => NativeBridgeAck::error(format!("invalid native bridge payload: {error}")),
    };

    let ack_payload = serde_json::to_vec(&ack).map_err(|error| {
        io::Error::new(
            io::ErrorKind::InvalidData,
            format!("serialize native bridge ack failed: {error}"),
        )
    })?;

    write_frame(stream, &ack_payload)?;

    Ok(())
}

#[tauri::command]
pub fn get_latest_native_web_app_event(
    state: State<'_, NativeBridgeState>,
) -> Result<Option<NativeWebAppEvent>, String> {
    state.latest()
}

#[cfg(test)]
mod tests {
    use super::{handle_bridge_payload, NativeBridgeAck, NativeBridgeState, NativeWebAppEvent};

    #[test]
    fn accepts_valid_bridge_payload() {
        let payload = serde_json::to_vec(&NativeWebAppEvent::UrlChange {
            url: "https://docs.google.com/document/d/example".to_string(),
            timestamp: 1_700_000_000_000,
        })
        .expect("payload should serialize");

        let ack = handle_bridge_payload(&payload);

        assert_eq!(ack, NativeBridgeAck::ok("native web app event accepted"));
    }

    #[test]
    fn accepts_tracking_stop_payload() {
        let payload = serde_json::to_vec(&NativeWebAppEvent::TrackingStop {
            timestamp: 1_700_000_000_000,
        })
        .expect("payload should serialize");

        assert_eq!(
            handle_bridge_payload(&payload),
            NativeBridgeAck::ok("native web app event accepted")
        );
    }

    #[test]
    fn stores_the_latest_event_for_frontend_replay() {
        let state = NativeBridgeState::default();
        let event = NativeWebAppEvent::TrackingStop { timestamp: 42 };

        state.record(event.clone()).expect("event should be stored");

        assert_eq!(
            state.latest().expect("state should be readable"),
            Some(event)
        );
    }

    #[test]
    fn rejects_invalid_bridge_payload() {
        let ack = handle_bridge_payload(br#"{"url":123}"#);

        assert!(!ack.success);
        assert!(ack.message.contains("invalid native bridge payload"));
    }
}
