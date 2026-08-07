//! 共有データモデルを定義するモジュール。
//! 現時点では型の土台のみを用意している。

pub mod activity;
pub mod app_usage_tracking;
pub mod settings;

pub use activity::{ActiveWindowInfo, ActivityCategory, ActivityRecord, AppRule, MatchType};
pub use app_usage_tracking::{
    FinalAppUsageSnapshot, ProcessObservation, RawTrackedAppDuration, RunningAppUsageSnapshot,
};
pub use settings::AppSettings;
