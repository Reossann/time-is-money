//! アプリ利用時間の集計に使う、OS や Tauri に依存しないモデル。

use std::{error::Error, fmt};

use serde::{Deserialize, Serialize};

pub const APP_USAGE_SNAPSHOT_SCHEMA_VERSION: u8 = 1;
pub const JAVASCRIPT_MAX_SAFE_INTEGER: u64 = 9_007_199_254_740_991;

/// ある時点で観測された前面プロセスの状態。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcessObservation {
    /// 実行ファイルの basename を加工せず保持する。
    Process(String),
    /// 前面ウィンドウを取得できなかった。
    NoForegroundWindow,
    /// OS からの観測処理自体が失敗した。
    ObservationFailed,
    /// time-is-money 自身が前面にいた。
    SelfProcess,
}

/// プロセス単位で集計した利用時間。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawTrackedAppDuration {
    pub process_name: String,
    pub duration_milliseconds: u64,
}

/// 計測中に取得する、その時点までの利用時間スナップショット。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunningAppUsageSnapshot {
    pub captured_offset_milliseconds: u64,
    pub duration_milliseconds: u64,
    pub tracked_duration_milliseconds: u64,
    pub untracked_duration_milliseconds: u64,
    pub apps: Vec<RawTrackedAppDuration>,
}

/// 計測終了時に確定する利用時間スナップショット。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinalAppUsageSnapshot {
    pub ended_offset_milliseconds: u64,
    pub duration_milliseconds: u64,
    pub tracked_duration_milliseconds: u64,
    pub untracked_duration_milliseconds: u64,
    pub apps: Vec<RawTrackedAppDuration>,
}

/// Tauri transportで返すraw process別milliseconds。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(
    rename_all = "camelCase",
    deny_unknown_fields,
    try_from = "UncheckedTrackedAppUsageWire"
)]
pub struct TrackedAppUsageWire {
    pub process_name: String,
    pub duration_milliseconds: u64,
}

impl TrackedAppUsageWire {
    pub fn new(
        process_name: String,
        duration_milliseconds: u64,
    ) -> Result<Self, AppUsageWireContractError> {
        ensure_safe_unsigned(duration_milliseconds)?;
        Ok(Self {
            process_name,
            duration_milliseconds,
        })
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UncheckedTrackedAppUsageWire {
    process_name: String,
    duration_milliseconds: u64,
}

impl TryFrom<UncheckedTrackedAppUsageWire> for TrackedAppUsageWire {
    type Error = AppUsageWireContractError;

    fn try_from(value: UncheckedTrackedAppUsageWire) -> Result<Self, Self::Error> {
        Self::new(value.process_name, value.duration_milliseconds)
    }
}

/// frontend serviceだけが受け取るraw wire snapshot。
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(
    rename_all = "camelCase",
    deny_unknown_fields,
    try_from = "UncheckedAppUsageSnapshotWire"
)]
pub struct AppUsageSnapshotWire {
    pub schema_version: u8,
    pub session_id: String,
    pub started_at: i64,
    pub captured_at: i64,
    pub duration_milliseconds: u64,
    pub tracked_duration_milliseconds: u64,
    pub untracked_duration_milliseconds: u64,
    pub apps: Vec<TrackedAppUsageWire>,
}

impl AppUsageSnapshotWire {
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        session_id: String,
        started_at: i64,
        captured_at: i64,
        duration_milliseconds: u64,
        tracked_duration_milliseconds: u64,
        untracked_duration_milliseconds: u64,
        apps: Vec<TrackedAppUsageWire>,
    ) -> Result<Self, AppUsageWireContractError> {
        let snapshot = Self {
            schema_version: APP_USAGE_SNAPSHOT_SCHEMA_VERSION,
            session_id,
            started_at,
            captured_at,
            duration_milliseconds,
            tracked_duration_milliseconds,
            untracked_duration_milliseconds,
            apps,
        };
        snapshot.validate()?;
        Ok(snapshot)
    }

    fn validate(&self) -> Result<(), AppUsageWireContractError> {
        if self.schema_version != APP_USAGE_SNAPSHOT_SCHEMA_VERSION {
            return Err(AppUsageWireContractError::UnsupportedSchemaVersion);
        }
        if self.session_id.trim().is_empty() {
            return Err(AppUsageWireContractError::InvalidSessionId);
        }
        ensure_safe_signed(self.started_at)?;
        ensure_safe_signed(self.captured_at)?;
        if self.captured_at < self.started_at {
            return Err(AppUsageWireContractError::InvalidBoundary);
        }
        ensure_safe_unsigned(self.duration_milliseconds)?;
        ensure_safe_unsigned(self.tracked_duration_milliseconds)?;
        ensure_safe_unsigned(self.untracked_duration_milliseconds)?;

        let expected_duration = u64::try_from(self.captured_at - self.started_at)
            .map_err(|_| AppUsageWireContractError::InvalidBoundary)?;
        if self.duration_milliseconds != expected_duration {
            return Err(AppUsageWireContractError::DurationMismatch);
        }

        let app_duration_sum = self.apps.iter().try_fold(0_u64, |sum, app| {
            ensure_safe_unsigned(app.duration_milliseconds)?;
            sum.checked_add(app.duration_milliseconds)
                .ok_or(AppUsageWireContractError::UnsafeInteger)
        })?;
        if app_duration_sum != self.tracked_duration_milliseconds {
            return Err(AppUsageWireContractError::TrackedDurationMismatch);
        }
        let covered_duration = self
            .tracked_duration_milliseconds
            .checked_add(self.untracked_duration_milliseconds)
            .ok_or(AppUsageWireContractError::UnsafeInteger)?;
        if covered_duration != self.duration_milliseconds {
            return Err(AppUsageWireContractError::CoveredDurationMismatch);
        }
        Ok(())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UncheckedAppUsageSnapshotWire {
    schema_version: u8,
    session_id: String,
    started_at: i64,
    captured_at: i64,
    duration_milliseconds: u64,
    tracked_duration_milliseconds: u64,
    untracked_duration_milliseconds: u64,
    apps: Vec<TrackedAppUsageWire>,
}

impl TryFrom<UncheckedAppUsageSnapshotWire> for AppUsageSnapshotWire {
    type Error = AppUsageWireContractError;

    fn try_from(value: UncheckedAppUsageSnapshotWire) -> Result<Self, Self::Error> {
        let snapshot = Self {
            schema_version: value.schema_version,
            session_id: value.session_id,
            started_at: value.started_at,
            captured_at: value.captured_at,
            duration_milliseconds: value.duration_milliseconds,
            tracked_duration_milliseconds: value.tracked_duration_milliseconds,
            untracked_duration_milliseconds: value.untracked_duration_milliseconds,
            apps: value.apps,
        };
        snapshot.validate()?;
        Ok(snapshot)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppUsageWireContractError {
    UnsupportedSchemaVersion,
    InvalidSessionId,
    InvalidBoundary,
    UnsafeInteger,
    DurationMismatch,
    TrackedDurationMismatch,
    CoveredDurationMismatch,
}

impl fmt::Display for AppUsageWireContractError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::UnsupportedSchemaVersion => "UNSUPPORTED_SCHEMA_VERSION",
            Self::InvalidSessionId => "INVALID_SESSION_ID",
            Self::InvalidBoundary => "INVALID_BOUNDARY",
            Self::UnsafeInteger => "UNSAFE_INTEGER",
            Self::DurationMismatch => "DURATION_MISMATCH",
            Self::TrackedDurationMismatch => "TRACKED_DURATION_MISMATCH",
            Self::CoveredDurationMismatch => "COVERED_DURATION_MISMATCH",
        })
    }
}

impl Error for AppUsageWireContractError {}

fn ensure_safe_signed(value: i64) -> Result<(), AppUsageWireContractError> {
    if value < 0 || value > JAVASCRIPT_MAX_SAFE_INTEGER as i64 {
        Err(AppUsageWireContractError::UnsafeInteger)
    } else {
        Ok(())
    }
}

fn ensure_safe_unsigned(value: u64) -> Result<(), AppUsageWireContractError> {
    if value > JAVASCRIPT_MAX_SAFE_INTEGER {
        Err(AppUsageWireContractError::UnsafeInteger)
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod wire_tests {
    use serde_json::{json, Value};

    use super::*;

    const SHARED_FIXTURE: &str =
        include_str!("../../../fixtures/contracts/app-usage-snapshot-v1.json");

    #[test]
    fn app_usage_tracking_shared_fixture_round_trips_with_camel_case() {
        let fixture_value: Value = serde_json::from_str(SHARED_FIXTURE).unwrap();
        let snapshot: AppUsageSnapshotWire = serde_json::from_str(SHARED_FIXTURE).unwrap();

        assert_eq!(snapshot.schema_version, APP_USAGE_SNAPSHOT_SCHEMA_VERSION);
        assert_eq!(snapshot.apps.len(), 3);
        assert_eq!(serde_json::to_value(snapshot).unwrap(), fixture_value);
    }

    #[test]
    fn app_usage_tracking_wire_rejects_snake_case_and_private_fields() {
        let fixture: Value = serde_json::from_str(SHARED_FIXTURE).unwrap();
        let mut snake_case = fixture.clone();
        let object = snake_case.as_object_mut().unwrap();
        let session_id = object.remove("sessionId").unwrap();
        object.insert("session_id".to_owned(), session_id);
        assert!(serde_json::from_value::<AppUsageSnapshotWire>(snake_case).is_err());

        for field in ["windowTitle", "processId", "fullPath", "url"] {
            let mut private = fixture.clone();
            private
                .as_object_mut()
                .unwrap()
                .insert(field.to_owned(), json!("private"));
            assert!(serde_json::from_value::<AppUsageSnapshotWire>(private).is_err());
        }
    }

    #[test]
    fn app_usage_tracking_wire_rejects_invalid_version_values_and_totals() {
        let fixture: Value = serde_json::from_str(SHARED_FIXTURE).unwrap();

        for (field, value) in [
            ("schemaVersion", json!(2)),
            ("startedAt", json!(-1)),
            ("capturedAt", json!(JAVASCRIPT_MAX_SAFE_INTEGER + 1)),
            ("trackedDurationMilliseconds", json!(2_699)),
            ("untrackedDurationMilliseconds", json!(799)),
        ] {
            let mut invalid = fixture.clone();
            invalid
                .as_object_mut()
                .unwrap()
                .insert(field.to_owned(), value);
            assert!(serde_json::from_value::<AppUsageSnapshotWire>(invalid).is_err());
        }
    }
}
