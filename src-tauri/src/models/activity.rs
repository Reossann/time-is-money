use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ActivityCategory {
    Productive,
    Waste,
    Neutral,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MatchType {
    Process,
    Title,
    Domain,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityRecord {
    pub id: String,
    pub process_name: String,
    pub window_title: String,
    pub category: ActivityCategory,
    pub started_at: i64,
    pub ended_at: Option<i64>,
    pub duration_seconds: i64,
    pub hourly_rate: f64,
    pub calculated_cost: f64,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppRule {
    pub id: String,
    pub match_type: MatchType,
    pub match_value: String,
    pub category: ActivityCategory,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveWindowInfo {
    pub process_name: String,
    pub window_title: String,
    pub process_id: u32,
}

#[cfg(test)]
mod tests {
    use super::{ActiveWindowInfo, ActivityCategory, ActivityRecord, AppRule, MatchType};
    use serde_json::json;

    #[test]
    fn activity_categories_use_lowercase_json_values() {
        for (category, expected_json) in [
            (ActivityCategory::Productive, r#""productive""#),
            (ActivityCategory::Waste, r#""waste""#),
            (ActivityCategory::Neutral, r#""neutral""#),
        ] {
            let json = serde_json::to_string(&category).expect("category should serialize");
            let deserialized: ActivityCategory =
                serde_json::from_str(expected_json).expect("category should deserialize");

            assert_eq!(json, expected_json);
            assert_eq!(deserialized, category);
        }
    }

    #[test]
    fn match_types_use_lowercase_json_values() {
        for (match_type, expected_json) in [
            (MatchType::Process, r#""process""#),
            (MatchType::Title, r#""title""#),
            (MatchType::Domain, r#""domain""#),
        ] {
            let json = serde_json::to_string(&match_type).expect("match type should serialize");
            let deserialized: MatchType =
                serde_json::from_str(expected_json).expect("match type should deserialize");

            assert_eq!(json, expected_json);
            assert_eq!(deserialized, match_type);
        }
    }

    #[test]
    fn activity_record_uses_camel_case_json_keys() {
        let original = ActivityRecord {
            id: "activity-1".to_owned(),
            process_name: "Code.exe".to_owned(),
            window_title: "time-is-money".to_owned(),
            category: ActivityCategory::Productive,
            started_at: 1_700_000_000,
            ended_at: Some(1_700_000_300),
            duration_seconds: 300,
            hourly_rate: 3_000.0,
            calculated_cost: 250.0,
        };
        let expected_json = json!({
            "id": "activity-1",
            "processName": "Code.exe",
            "windowTitle": "time-is-money",
            "category": "productive",
            "startedAt": 1_700_000_000_i64,
            "endedAt": 1_700_000_300_i64,
            "durationSeconds": 300,
            "hourlyRate": 3_000.0,
            "calculatedCost": 250.0,
        });

        let serialized = serde_json::to_value(&original).expect("activity record should serialize");
        let deserialized: ActivityRecord = serde_json::from_value(expected_json.clone())
            .expect("camelCase activity record should deserialize");

        assert_eq!(serialized, expected_json);
        assert_eq!(deserialized, original);
    }

    #[test]
    fn activity_record_accepts_null_ended_at() {
        let original = ActivityRecord {
            id: "activity-2".to_owned(),
            process_name: "Terminal.exe".to_owned(),
            window_title: "PowerShell".to_owned(),
            category: ActivityCategory::Neutral,
            started_at: 1_700_001_000,
            ended_at: None,
            duration_seconds: 0,
            hourly_rate: 3_000.0,
            calculated_cost: 0.0,
        };
        let expected_json = json!({
            "id": "activity-2",
            "processName": "Terminal.exe",
            "windowTitle": "PowerShell",
            "category": "neutral",
            "startedAt": 1_700_001_000_i64,
            "endedAt": null,
            "durationSeconds": 0,
            "hourlyRate": 3_000.0,
            "calculatedCost": 0.0,
        });

        let serialized = serde_json::to_value(&original).expect("activity record should serialize");
        let deserialized: ActivityRecord = serde_json::from_value(expected_json.clone())
            .expect("activity record with null endedAt should deserialize");

        assert_eq!(serialized, expected_json);
        assert_eq!(deserialized, original);
    }

    #[test]
    fn app_rule_uses_camel_case_json_keys() {
        let original = AppRule {
            id: "rule-1".to_owned(),
            match_type: MatchType::Process,
            match_value: "Code.exe".to_owned(),
            category: ActivityCategory::Productive,
        };
        let expected_json = json!({
            "id": "rule-1",
            "matchType": "process",
            "matchValue": "Code.exe",
            "category": "productive",
        });

        let serialized = serde_json::to_value(&original).expect("app rule should serialize");
        let deserialized: AppRule = serde_json::from_value(expected_json.clone())
            .expect("camelCase app rule should deserialize");

        assert_eq!(serialized, expected_json);
        assert_eq!(deserialized, original);
    }

    #[test]
    fn active_window_info_uses_camel_case_json_keys() {
        let original = ActiveWindowInfo {
            process_name: "Code.exe".to_owned(),
            window_title: "time-is-money".to_owned(),
            process_id: 4_242,
        };
        let expected_json = json!({
            "processName": "Code.exe",
            "windowTitle": "time-is-money",
            "processId": 4_242,
        });

        let serialized =
            serde_json::to_value(&original).expect("active window info should serialize");
        let deserialized: ActiveWindowInfo = serde_json::from_value(expected_json.clone())
            .expect("camelCase active window info should deserialize");

        assert_eq!(serialized, expected_json);
        assert_eq!(deserialized, original);
    }
}
