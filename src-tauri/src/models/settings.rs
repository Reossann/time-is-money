use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppSettings {
    pub hourly_rate: f64,
    pub notification_threshold_minutes: u32,
    pub idle_threshold_minutes: u32,
    pub notifications_enabled: bool,
}
