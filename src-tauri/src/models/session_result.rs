use std::{collections::HashSet, error::Error, fmt};

use serde::{Deserialize, Serialize};

use super::{activity::ActivityCategory, app_usage_tracking::JAVASCRIPT_MAX_SAFE_INTEGER};

pub const SESSION_RESULT_SCHEMA_VERSION: u8 = 1;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(
    rename_all = "camelCase",
    deny_unknown_fields,
    try_from = "UncheckedMoneyBreakdownWire"
)]
pub struct MoneyBreakdownWire {
    pub earned_yen: u64,
    pub wasted_yen: u64,
    pub net_yen: i64,
}

impl MoneyBreakdownWire {
    fn validate(&self) -> Result<(), SessionResultWireContractError> {
        ensure_safe_unsigned(self.earned_yen)?;
        ensure_safe_unsigned(self.wasted_yen)?;
        ensure_safe_money_net(self.net_yen)?;

        let expected_net = i64::try_from(self.earned_yen)
            .map_err(|_| SessionResultWireContractError::UnsafeInteger)?
            - i64::try_from(self.wasted_yen)
                .map_err(|_| SessionResultWireContractError::UnsafeInteger)?;
        if self.net_yen != expected_net {
            return Err(SessionResultWireContractError::MoneyMismatch);
        }
        Ok(())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UncheckedMoneyBreakdownWire {
    earned_yen: u64,
    wasted_yen: u64,
    net_yen: i64,
}

impl TryFrom<UncheckedMoneyBreakdownWire> for MoneyBreakdownWire {
    type Error = SessionResultWireContractError;

    fn try_from(value: UncheckedMoneyBreakdownWire) -> Result<Self, Self::Error> {
        let money = Self {
            earned_yen: value.earned_yen,
            wasted_yen: value.wasted_yen,
            net_yen: value.net_yen,
        };
        money.validate()?;
        Ok(money)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(
    rename_all = "camelCase",
    deny_unknown_fields,
    try_from = "UncheckedSessionAppResultWire"
)]
pub struct SessionAppResultWire {
    pub app_id: String,
    pub process_name: String,
    pub duration_seconds: u64,
    pub category: Option<ActivityCategory>,
    pub hourly_rate_yen: f64,
    pub money: MoneyBreakdownWire,
}

impl SessionAppResultWire {
    fn validate(&self) -> Result<(), SessionResultWireContractError> {
        if self.app_id.trim().is_empty() || self.process_name.trim().is_empty() {
            return Err(SessionResultWireContractError::InvalidAppIdentity);
        }
        ensure_safe_unsigned(self.duration_seconds)?;
        if self.duration_seconds == 0 {
            return Err(SessionResultWireContractError::InvalidAppDuration);
        }
        if !self.hourly_rate_yen.is_finite() || self.hourly_rate_yen < 0.0 {
            return Err(SessionResultWireContractError::InvalidHourlyRate);
        }
        self.money.validate()
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UncheckedSessionAppResultWire {
    app_id: String,
    process_name: String,
    duration_seconds: u64,
    category: Option<ActivityCategory>,
    hourly_rate_yen: f64,
    money: MoneyBreakdownWire,
}

impl TryFrom<UncheckedSessionAppResultWire> for SessionAppResultWire {
    type Error = SessionResultWireContractError;

    fn try_from(value: UncheckedSessionAppResultWire) -> Result<Self, Self::Error> {
        let app = Self {
            app_id: value.app_id,
            process_name: value.process_name,
            duration_seconds: value.duration_seconds,
            category: value.category,
            hourly_rate_yen: value.hourly_rate_yen,
            money: value.money,
        };
        app.validate()?;
        Ok(app)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(
    rename_all = "camelCase",
    deny_unknown_fields,
    try_from = "UncheckedSessionResultWire"
)]
pub struct SessionResultWire {
    pub schema_version: u8,
    pub session_id: String,
    pub started_at: i64,
    pub ended_at: i64,
    pub duration_seconds: u64,
    pub tracked_duration_seconds: u64,
    pub untracked_duration_seconds: u64,
    pub apps: Vec<SessionAppResultWire>,
    pub totals: MoneyBreakdownWire,
}

impl SessionResultWire {
    fn validate(&self) -> Result<(), SessionResultWireContractError> {
        if self.schema_version != SESSION_RESULT_SCHEMA_VERSION {
            return Err(SessionResultWireContractError::UnsupportedSchemaVersion);
        }
        if self.session_id.trim().is_empty() {
            return Err(SessionResultWireContractError::InvalidSessionId);
        }
        ensure_safe_signed(self.started_at)?;
        ensure_safe_signed(self.ended_at)?;
        if self.ended_at < self.started_at {
            return Err(SessionResultWireContractError::InvalidBoundary);
        }
        ensure_safe_unsigned(self.duration_seconds)?;
        ensure_safe_unsigned(self.tracked_duration_seconds)?;
        ensure_safe_unsigned(self.untracked_duration_seconds)?;

        let elapsed_milliseconds = u64::try_from(self.ended_at - self.started_at)
            .map_err(|_| SessionResultWireContractError::InvalidBoundary)?;
        if self.duration_seconds != elapsed_milliseconds / 1_000 {
            return Err(SessionResultWireContractError::DurationMismatch);
        }

        let mut app_ids = HashSet::new();
        let mut app_duration_sum = 0_u64;
        let mut earned_yen = 0_u64;
        let mut wasted_yen = 0_u64;
        for (index, app) in self.apps.iter().enumerate() {
            app.validate()?;
            if !app_ids.insert(&app.app_id) {
                return Err(SessionResultWireContractError::DuplicateAppId);
            }
            app_duration_sum = app_duration_sum
                .checked_add(app.duration_seconds)
                .ok_or(SessionResultWireContractError::UnsafeInteger)?;
            earned_yen = earned_yen
                .checked_add(app.money.earned_yen)
                .ok_or(SessionResultWireContractError::UnsafeInteger)?;
            wasted_yen = wasted_yen
                .checked_add(app.money.wasted_yen)
                .ok_or(SessionResultWireContractError::UnsafeInteger)?;

            if index > 0 {
                let previous = &self.apps[index - 1];
                if previous.duration_seconds < app.duration_seconds
                    || (previous.duration_seconds == app.duration_seconds
                        && previous.app_id > app.app_id)
                {
                    return Err(SessionResultWireContractError::NonDeterministicAppOrder);
                }
            }
        }
        ensure_safe_unsigned(app_duration_sum)?;
        ensure_safe_unsigned(earned_yen)?;
        ensure_safe_unsigned(wasted_yen)?;

        if app_duration_sum != self.tracked_duration_seconds {
            return Err(SessionResultWireContractError::TrackedDurationMismatch);
        }
        let covered_duration = self
            .tracked_duration_seconds
            .checked_add(self.untracked_duration_seconds)
            .ok_or(SessionResultWireContractError::UnsafeInteger)?;
        if covered_duration != self.duration_seconds {
            return Err(SessionResultWireContractError::CoveredDurationMismatch);
        }

        self.totals.validate()?;
        let expected_net = i64::try_from(earned_yen)
            .map_err(|_| SessionResultWireContractError::UnsafeInteger)?
            - i64::try_from(wasted_yen)
                .map_err(|_| SessionResultWireContractError::UnsafeInteger)?;
        if self.totals.earned_yen != earned_yen
            || self.totals.wasted_yen != wasted_yen
            || self.totals.net_yen != expected_net
        {
            return Err(SessionResultWireContractError::TotalsMismatch);
        }
        Ok(())
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct UncheckedSessionResultWire {
    schema_version: u8,
    session_id: String,
    started_at: i64,
    ended_at: i64,
    duration_seconds: u64,
    tracked_duration_seconds: u64,
    untracked_duration_seconds: u64,
    apps: Vec<SessionAppResultWire>,
    totals: MoneyBreakdownWire,
}

impl TryFrom<UncheckedSessionResultWire> for SessionResultWire {
    type Error = SessionResultWireContractError;

    fn try_from(value: UncheckedSessionResultWire) -> Result<Self, Self::Error> {
        let result = Self {
            schema_version: value.schema_version,
            session_id: value.session_id,
            started_at: value.started_at,
            ended_at: value.ended_at,
            duration_seconds: value.duration_seconds,
            tracked_duration_seconds: value.tracked_duration_seconds,
            untracked_duration_seconds: value.untracked_duration_seconds,
            apps: value.apps,
            totals: value.totals,
        };
        result.validate()?;
        Ok(result)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionResultWireContractError {
    UnsupportedSchemaVersion,
    InvalidSessionId,
    InvalidBoundary,
    UnsafeInteger,
    DurationMismatch,
    InvalidAppIdentity,
    InvalidAppDuration,
    InvalidHourlyRate,
    MoneyMismatch,
    DuplicateAppId,
    NonDeterministicAppOrder,
    TrackedDurationMismatch,
    CoveredDurationMismatch,
    TotalsMismatch,
}

impl fmt::Display for SessionResultWireContractError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(match self {
            Self::UnsupportedSchemaVersion => "UNSUPPORTED_SCHEMA_VERSION",
            Self::InvalidSessionId => "INVALID_SESSION_ID",
            Self::InvalidBoundary => "INVALID_BOUNDARY",
            Self::UnsafeInteger => "UNSAFE_INTEGER",
            Self::DurationMismatch => "DURATION_MISMATCH",
            Self::InvalidAppIdentity => "INVALID_APP_IDENTITY",
            Self::InvalidAppDuration => "INVALID_APP_DURATION",
            Self::InvalidHourlyRate => "INVALID_HOURLY_RATE",
            Self::MoneyMismatch => "MONEY_MISMATCH",
            Self::DuplicateAppId => "DUPLICATE_APP_ID",
            Self::NonDeterministicAppOrder => "NON_DETERMINISTIC_APP_ORDER",
            Self::TrackedDurationMismatch => "TRACKED_DURATION_MISMATCH",
            Self::CoveredDurationMismatch => "COVERED_DURATION_MISMATCH",
            Self::TotalsMismatch => "TOTALS_MISMATCH",
        })
    }
}

impl Error for SessionResultWireContractError {}

fn ensure_safe_signed(value: i64) -> Result<(), SessionResultWireContractError> {
    if value < 0 || value > JAVASCRIPT_MAX_SAFE_INTEGER as i64 {
        Err(SessionResultWireContractError::UnsafeInteger)
    } else {
        Ok(())
    }
}

fn ensure_safe_unsigned(value: u64) -> Result<(), SessionResultWireContractError> {
    if value > JAVASCRIPT_MAX_SAFE_INTEGER {
        Err(SessionResultWireContractError::UnsafeInteger)
    } else {
        Ok(())
    }
}

fn ensure_safe_money_net(value: i64) -> Result<(), SessionResultWireContractError> {
    let limit = JAVASCRIPT_MAX_SAFE_INTEGER as i64;
    if value < -limit || value > limit {
        Err(SessionResultWireContractError::UnsafeInteger)
    } else {
        Ok(())
    }
}

#[cfg(test)]
mod wire_tests {
    use serde_json::{json, Value};

    use super::*;

    const SHARED_FIXTURE: &str = include_str!("../../../fixtures/contracts/session-result-v1.json");

    #[test]
    fn session_result_shared_fixture_round_trips_with_camel_case() {
        let fixture_value: Value = serde_json::from_str(SHARED_FIXTURE).unwrap();
        let result: SessionResultWire = serde_json::from_str(SHARED_FIXTURE).unwrap();

        assert_eq!(result.schema_version, SESSION_RESULT_SCHEMA_VERSION);
        assert_eq!(result.apps.len(), 3);
        assert_eq!(result.apps[2].category, None);
        assert_eq!(serde_json::to_value(result).unwrap(), fixture_value);
    }

    #[test]
    fn session_result_wire_rejects_snake_case_and_private_fields() {
        let fixture: Value = serde_json::from_str(SHARED_FIXTURE).unwrap();
        let mut snake_case = fixture.clone();
        let object = snake_case.as_object_mut().unwrap();
        let session_id = object.remove("sessionId").unwrap();
        object.insert("session_id".to_owned(), session_id);
        assert!(serde_json::from_value::<SessionResultWire>(snake_case).is_err());

        for field in ["windowTitle", "processId", "fullPath", "url"] {
            let mut private = fixture.clone();
            private
                .as_object_mut()
                .unwrap()
                .insert(field.to_owned(), json!("private"));
            assert!(serde_json::from_value::<SessionResultWire>(private).is_err());
        }

        let mut private_app_field = fixture.clone();
        private_app_field.as_object_mut().unwrap()["apps"]
            .as_array_mut()
            .unwrap()[0]["windowTitle"] = json!("private");
        assert!(serde_json::from_value::<SessionResultWire>(private_app_field).is_err());
    }

    #[test]
    fn session_result_wire_rejects_invalid_values_and_totals() {
        let fixture: Value = serde_json::from_str(SHARED_FIXTURE).unwrap();

        for (field, value) in [
            ("schemaVersion", json!(2)),
            ("startedAt", json!(-1)),
            ("endedAt", json!(JAVASCRIPT_MAX_SAFE_INTEGER + 1)),
            ("trackedDurationSeconds", json!(7)),
            ("untrackedDurationSeconds", json!(2)),
        ] {
            let mut invalid = fixture.clone();
            invalid
                .as_object_mut()
                .unwrap()
                .insert(field.to_owned(), value);
            assert!(serde_json::from_value::<SessionResultWire>(invalid).is_err());
        }

        let mut unknown_category = fixture.clone();
        unknown_category.as_object_mut().unwrap()["apps"]
            .as_array_mut()
            .unwrap()[0]["category"] = json!("unknown");
        assert!(serde_json::from_value::<SessionResultWire>(unknown_category).is_err());

        let invalid_hourly_rate = UncheckedSessionAppResultWire {
            app_id: "code.exe".to_owned(),
            process_name: "Code.exe".to_owned(),
            duration_seconds: 1,
            category: Some(ActivityCategory::Productive),
            hourly_rate_yen: f64::NAN,
            money: MoneyBreakdownWire {
                earned_yen: 0,
                wasted_yen: 0,
                net_yen: 0,
            },
        };
        assert!(SessionAppResultWire::try_from(invalid_hourly_rate).is_err());
    }
}
