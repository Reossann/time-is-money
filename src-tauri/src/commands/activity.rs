//! 前面ウィンドウ情報とアプリ利用時間に関する Tauri Command。

use serde::Serialize;
use tauri::State;

use crate::{
    models::{
        ActiveWindowInfo, AppUsageSnapshotWire, RawTrackedAppDuration, TrackedAppUsageWire,
        JAVASCRIPT_MAX_SAFE_INTEGER,
    },
    platform::windows,
    services::app_usage_tracker::{AppUsageTracker, AppUsageTrackerError, TrackingSnapshot},
};

/// 現在の前面ウィンドウ情報を1回分取得する。
///
/// 前面ウィンドウがない瞬間は `Ok(None)`、取得できた場合は `Ok(Some(...))`、
/// Windows APIの失敗は機密値を含まないCommand errorとして返す。
#[tauri::command]
pub fn get_active_window_info() -> Result<Option<ActiveWindowInfo>, String> {
    windows::get_active_window_info().map_err(|error| error.to_string())
}

/// 同じsession IDと開始境界で前面アプリの継続観測を開始する。
#[tauri::command(rename_all = "camelCase")]
pub fn start_app_usage_tracking(
    tracker: State<'_, AppUsageTracker>,
    session_id: String,
    started_at: i64,
) -> Result<(), AppUsageTrackingCommandError> {
    validate_session_id(&session_id)?;
    validate_epoch_milliseconds(started_at)?;
    tracker
        .start(session_id, started_at)
        .map(|_| ())
        .map_err(AppUsageTrackingCommandError::from)
}

/// running sessionの内部状態を変更せず、その時点までのraw snapshotを返す。
#[tauri::command(rename_all = "camelCase")]
pub fn get_app_usage_tracking_snapshot(
    tracker: State<'_, AppUsageTracker>,
    session_id: String,
    captured_at: i64,
) -> Result<AppUsageSnapshotWire, AppUsageTrackingCommandError> {
    validate_session_id(&session_id)?;
    validate_epoch_milliseconds(captured_at)?;
    let snapshot = tracker
        .snapshot(&session_id, captured_at)
        .map_err(AppUsageTrackingCommandError::from)?;
    tracking_snapshot_to_wire(snapshot)
}

/// 最初の終了境界でworkerを停止し、固定したraw snapshotを返す。
#[tauri::command(rename_all = "camelCase")]
pub fn stop_app_usage_tracking(
    tracker: State<'_, AppUsageTracker>,
    session_id: String,
    ended_at: i64,
) -> Result<AppUsageSnapshotWire, AppUsageTrackingCommandError> {
    validate_session_id(&session_id)?;
    validate_epoch_milliseconds(ended_at)?;
    let snapshot = tracker
        .stop(&session_id, ended_at)
        .map_err(AppUsageTrackingCommandError::from)?;
    final_tracking_snapshot_to_wire(snapshot)
}

/// frontendへ返すerrorは安定code一つだけに限定する。
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AppUsageTrackingCommandError {
    pub code: &'static str,
}

impl AppUsageTrackingCommandError {
    const fn invalid_boundary() -> Self {
        Self {
            code: "INVALID_BOUNDARY",
        }
    }

    const fn internal() -> Self {
        Self { code: "INTERNAL" }
    }
}

impl From<AppUsageTrackerError> for AppUsageTrackingCommandError {
    fn from(error: AppUsageTrackerError) -> Self {
        Self { code: error.code() }
    }
}

fn validate_session_id(session_id: &str) -> Result<(), AppUsageTrackingCommandError> {
    if session_id.trim().is_empty() {
        Err(AppUsageTrackingCommandError::invalid_boundary())
    } else {
        Ok(())
    }
}

fn validate_epoch_milliseconds(value: i64) -> Result<(), AppUsageTrackingCommandError> {
    if value < 0 || value > JAVASCRIPT_MAX_SAFE_INTEGER as i64 {
        Err(AppUsageTrackingCommandError::invalid_boundary())
    } else {
        Ok(())
    }
}

fn tracking_snapshot_to_wire(
    snapshot: TrackingSnapshot,
) -> Result<AppUsageSnapshotWire, AppUsageTrackingCommandError> {
    match snapshot {
        TrackingSnapshot::Running(snapshot) => AppUsageSnapshotWire::new(
            snapshot.session_id,
            snapshot.started_at,
            snapshot.captured_at,
            snapshot.usage.duration_milliseconds,
            snapshot.usage.tracked_duration_milliseconds,
            snapshot.usage.untracked_duration_milliseconds,
            tracked_apps_to_wire(snapshot.usage.apps)?,
        )
        .map_err(|_| AppUsageTrackingCommandError::internal()),
        TrackingSnapshot::Final(snapshot) => final_tracking_snapshot_to_wire(snapshot),
    }
}

fn final_tracking_snapshot_to_wire(
    snapshot: crate::services::app_usage_tracker::FinalTrackingSnapshot,
) -> Result<AppUsageSnapshotWire, AppUsageTrackingCommandError> {
    AppUsageSnapshotWire::new(
        snapshot.session_id,
        snapshot.started_at,
        snapshot.ended_at,
        snapshot.usage.duration_milliseconds,
        snapshot.usage.tracked_duration_milliseconds,
        snapshot.usage.untracked_duration_milliseconds,
        tracked_apps_to_wire(snapshot.usage.apps)?,
    )
    .map_err(|_| AppUsageTrackingCommandError::internal())
}

fn tracked_apps_to_wire(
    apps: Vec<RawTrackedAppDuration>,
) -> Result<Vec<TrackedAppUsageWire>, AppUsageTrackingCommandError> {
    apps.into_iter()
        .map(|app| {
            TrackedAppUsageWire::new(app.process_name, app.duration_milliseconds)
                .map_err(|_| AppUsageTrackingCommandError::internal())
        })
        .collect()
}

#[cfg(test)]
mod app_usage_tracking_tests {
    use crate::{
        models::{FinalAppUsageSnapshot, RunningAppUsageSnapshot},
        services::app_usage_tracker::{FinalTrackingSnapshot, RunningTrackingSnapshot},
    };

    use super::*;

    #[test]
    fn app_usage_tracking_command_validates_session_and_safe_epoch_boundaries() {
        assert_eq!(
            validate_session_id("  "),
            Err(AppUsageTrackingCommandError::invalid_boundary())
        );
        assert_eq!(
            validate_epoch_milliseconds(-1),
            Err(AppUsageTrackingCommandError::invalid_boundary())
        );
        assert_eq!(
            validate_epoch_milliseconds(JAVASCRIPT_MAX_SAFE_INTEGER as i64 + 1),
            Err(AppUsageTrackingCommandError::invalid_boundary())
        );
        assert!(validate_session_id("session-a").is_ok());
        assert!(validate_epoch_milliseconds(1_000).is_ok());
    }

    #[test]
    fn app_usage_tracking_command_maps_tracker_errors_to_stable_codes() {
        for (error, code) in [
            (
                AppUsageTrackerError::TrackingAlreadyRunning,
                "TRACKING_ALREADY_RUNNING",
            ),
            (AppUsageTrackerError::SessionMismatch, "SESSION_MISMATCH"),
            (
                AppUsageTrackerError::StopBoundaryConflict,
                "STOP_BOUNDARY_CONFLICT",
            ),
            (
                AppUsageTrackerError::TrackingNotRunning,
                "TRACKING_NOT_RUNNING",
            ),
            (AppUsageTrackerError::InvalidBoundary, "INVALID_BOUNDARY"),
            (AppUsageTrackerError::Internal, "INTERNAL"),
        ] {
            assert_eq!(AppUsageTrackingCommandError::from(error).code, code);
        }
    }

    #[test]
    fn app_usage_tracking_command_converts_running_and_final_snapshots() {
        let apps = vec![RawTrackedAppDuration {
            process_name: "Code.exe".to_owned(),
            duration_milliseconds: 750,
        }];
        let running = TrackingSnapshot::Running(RunningTrackingSnapshot {
            session_id: "session-a".to_owned(),
            started_at: 1_000,
            captured_at: 2_000,
            usage: RunningAppUsageSnapshot {
                captured_offset_milliseconds: 1_000,
                duration_milliseconds: 1_000,
                tracked_duration_milliseconds: 750,
                untracked_duration_milliseconds: 250,
                apps: apps.clone(),
            },
        });
        let final_snapshot = FinalTrackingSnapshot {
            session_id: "session-a".to_owned(),
            started_at: 1_000,
            ended_at: 2_000,
            usage: FinalAppUsageSnapshot {
                ended_offset_milliseconds: 1_000,
                duration_milliseconds: 1_000,
                tracked_duration_milliseconds: 750,
                untracked_duration_milliseconds: 250,
                apps,
            },
        };

        let running_wire = tracking_snapshot_to_wire(running).unwrap();
        let final_wire = final_tracking_snapshot_to_wire(final_snapshot).unwrap();

        assert_eq!(running_wire, final_wire);
        assert_eq!(running_wire.captured_at, 2_000);
        assert_eq!(running_wire.apps[0].process_name, "Code.exe");
    }
}
