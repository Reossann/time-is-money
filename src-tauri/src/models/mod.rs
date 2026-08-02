//! 共有データモデルを定義するモジュール。
//! 現時点では型の土台のみを用意している。

pub mod activity;
pub mod settings;

pub use activity::{ActivityCategory, ActivityRecord, ActiveWindowInfo, AppRule, MatchType};
pub use settings::AppSettings;