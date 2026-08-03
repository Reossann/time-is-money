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
pub struct AppRule {
    pub id: String,
    pub match_type: MatchType,
    pub match_value: String,
    pub category: ActivityCategory,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ActiveWindowInfo {
    pub process_name: String,
    pub window_title: String,
    pub process_id: u32,
}

#[cfg(test)]
mod tests {
    use super::{ActivityCategory, ActivityRecord, MatchType};

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
    fn activity_record_round_trips_through_json() {
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

        let json = serde_json::to_string(&original).expect("activity record should serialize");
        let deserialized: ActivityRecord =
            serde_json::from_str(&json).expect("activity record should deserialize");

        assert_eq!(deserialized, original);
    }
}
