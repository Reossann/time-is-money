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
