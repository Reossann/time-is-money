use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct AppSettings {
    pub hourly_rate: f64,
    pub notification_threshold_minutes: u32,
    pub idle_threshold_minutes: u32,
    pub notifications_enabled: bool,
}

#[cfg(test)]
mod tests {
    use super::AppSettings;

    #[test]
    fn app_settings_round_trip_through_json() {
        let original = AppSettings {
            hourly_rate: 3_000.0,
            notification_threshold_minutes: 30,
            idle_threshold_minutes: 5,
            notifications_enabled: true,
        };

        let json = serde_json::to_string(&original).expect("settings should serialize");
        let deserialized: AppSettings =
            serde_json::from_str(&json).expect("settings should deserialize");

        assert_eq!(deserialized, original);
    }
}
