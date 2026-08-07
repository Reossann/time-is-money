//! 共有データモデルを定義するモジュール。
//! 現時点では型の土台のみを用意している。

pub mod activity;
pub mod app_usage_tracking;
pub mod settings;

pub use activity::{ActiveWindowInfo, ActivityCategory, ActivityRecord, AppRule, MatchType};
pub use app_usage_tracking::{
    AppUsageSnapshotWire, FinalAppUsageSnapshot, ProcessObservation, RawTrackedAppDuration,
    RunningAppUsageSnapshot, TrackedAppUsageWire, APP_USAGE_SNAPSHOT_SCHEMA_VERSION,
    JAVASCRIPT_MAX_SAFE_INTEGER,
};
pub use settings::AppSettings;
