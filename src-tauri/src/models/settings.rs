use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub hourly_rate: f64,
    pub notification_threshold_minutes: u32,
    pub idle_threshold_minutes: u32,
    pub notifications_enabled: bool,
    #[serde(default)]
    pub notification_tone: Option<String>,
    #[serde(default)]
    pub notification_interval_minutes: Option<u32>,
}

#[cfg(test)]
mod tests {
    use super::AppSettings;
    use serde_json::json;

    #[test]
    fn app_settings_uses_camel_case_json_keys() {
        let original = AppSettings {
            hourly_rate: 3_000.0,
            notification_threshold_minutes: 30,
            idle_threshold_minutes: 5,
            notifications_enabled: true,
            notification_tone: Some("gentle".to_string()),
            notification_interval_minutes: Some(30),
        };
        let expected_json = json!({
            "hourlyRate": 3_000.0,
            "notificationThresholdMinutes": 30,
            "idleThresholdMinutes": 5,
            "notificationsEnabled": true,
            "notificationTone": "gentle",
            "notificationIntervalMinutes": 30,
        });

        let serialized = serde_json::to_value(&original).expect("settings should serialize");
        let deserialized: AppSettings = serde_json::from_value(expected_json.clone())
            .expect("camelCase settings should deserialize");

        assert_eq!(serialized, expected_json);
        assert_eq!(deserialized, original);
    }
}
