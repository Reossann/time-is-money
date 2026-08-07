//! タイムスタンプ付きのプロセス観測を、排他的な利用時間へ変換する。

use std::{collections::BTreeMap, error::Error, fmt};

use crate::models::{
    FinalAppUsageSnapshot, ProcessObservation, RawTrackedAppDuration, RunningAppUsageSnapshot,
};

/// この値を超えて観測が途切れた場合、その区間全体を未追跡として扱う。
pub const MAX_CREDITABLE_GAP_MILLISECONDS: u64 = 5_000;

/// accumulator が返す、呼び出し側で安定して識別可能なドメインエラー。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppUsageAccumulatorError {
    OffsetBeforeStart,
    ClockMovedBackwards,
    StopBeforeLastObservation,
    ObservationAfterFinalization,
    DurationOverflow,
    InvariantViolation,
}

impl AppUsageAccumulatorError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::OffsetBeforeStart => "OFFSET_BEFORE_START",
            Self::ClockMovedBackwards => "CLOCK_MOVED_BACKWARDS",
            Self::StopBeforeLastObservation => "STOP_BEFORE_LAST_OBSERVATION",
            Self::ObservationAfterFinalization => "OBSERVATION_AFTER_FINALIZATION",
            Self::DurationOverflow => "DURATION_OVERFLOW",
            Self::InvariantViolation => "INVARIANT_VIOLATION",
        }
    }
}

impl fmt::Display for AppUsageAccumulatorError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

impl Error for AppUsageAccumulatorError {}

#[derive(Debug, Clone, PartialEq, Eq)]
enum ActiveBucket {
    Process(String),
    Untracked,
}

impl From<ProcessObservation> for ActiveBucket {
    fn from(observation: ProcessObservation) -> Self {
        match observation {
            ProcessObservation::Process(process_name) => Self::Process(process_name),
            ProcessObservation::NoForegroundWindow
            | ProcessObservation::ObservationFailed
            | ProcessObservation::SelfProcess => Self::Untracked,
        }
    }
}

/// セッション開始からの単調増加 offset を受け取り、各区間を一箇所だけに加算する。
#[derive(Debug, Clone)]
pub struct AppUsageAccumulator {
    last_observation_offset_milliseconds: u64,
    active_bucket: ActiveBucket,
    app_durations: BTreeMap<String, u64>,
    untracked_duration_milliseconds: u64,
    final_snapshot: Option<FinalAppUsageSnapshot>,
}

impl Default for AppUsageAccumulator {
    fn default() -> Self {
        Self::new()
    }
}

impl AppUsageAccumulator {
    /// セッション開始直後は、最初の観測までを未追跡区間として開始する。
    pub fn new() -> Self {
        Self {
            last_observation_offset_milliseconds: 0,
            active_bucket: ActiveBucket::Untracked,
            app_durations: BTreeMap::new(),
            untracked_duration_milliseconds: 0,
            final_snapshot: None,
        }
    }

    /// 観測時刻まで直前の状態を加算し、以後の状態を今回の観測へ切り替える。
    pub fn observe(
        &mut self,
        offset_milliseconds: i128,
        observation: ProcessObservation,
    ) -> Result<(), AppUsageAccumulatorError> {
        if self.final_snapshot.is_some() {
            return Err(AppUsageAccumulatorError::ObservationAfterFinalization);
        }

        let offset_milliseconds = Self::normalize_offset(offset_milliseconds)?;
        if offset_milliseconds < self.last_observation_offset_milliseconds {
            return Err(AppUsageAccumulatorError::ClockMovedBackwards);
        }

        self.credit_until(offset_milliseconds)?;
        self.last_observation_offset_milliseconds = offset_milliseconds;
        self.active_bucket = observation.into();
        Ok(())
    }

    /// 内部状態を変更せず、指定時刻までを仮集計したスナップショットを返す。
    pub fn snapshot_at(
        &self,
        offset_milliseconds: i128,
    ) -> Result<RunningAppUsageSnapshot, AppUsageAccumulatorError> {
        let offset_milliseconds = Self::normalize_offset(offset_milliseconds)?;
        if offset_milliseconds < self.last_observation_offset_milliseconds {
            return Err(AppUsageAccumulatorError::ClockMovedBackwards);
        }

        if let Some(snapshot) = &self.final_snapshot {
            return Ok(RunningAppUsageSnapshot {
                captured_offset_milliseconds: snapshot.ended_offset_milliseconds,
                duration_milliseconds: snapshot.duration_milliseconds,
                tracked_duration_milliseconds: snapshot.tracked_duration_milliseconds,
                untracked_duration_milliseconds: snapshot.untracked_duration_milliseconds,
                apps: snapshot.apps.clone(),
            });
        }

        let mut preview = self.clone();
        preview.credit_until(offset_milliseconds)?;
        preview.running_snapshot(offset_milliseconds)
    }

    /// 終了時刻までを確定する。同じ accumulator への再実行は最初の結果を返す。
    pub fn finalize(
        &mut self,
        stop_offset_milliseconds: i128,
    ) -> Result<FinalAppUsageSnapshot, AppUsageAccumulatorError> {
        if let Some(snapshot) = &self.final_snapshot {
            return Ok(snapshot.clone());
        }

        let stop_offset_milliseconds = Self::normalize_offset(stop_offset_milliseconds)?;
        if stop_offset_milliseconds < self.last_observation_offset_milliseconds {
            return Err(AppUsageAccumulatorError::StopBeforeLastObservation);
        }

        self.credit_until(stop_offset_milliseconds)?;
        self.last_observation_offset_milliseconds = stop_offset_milliseconds;
        let values = self.snapshot_values(stop_offset_milliseconds)?;
        let snapshot = FinalAppUsageSnapshot {
            ended_offset_milliseconds: stop_offset_milliseconds,
            duration_milliseconds: stop_offset_milliseconds,
            tracked_duration_milliseconds: values.tracked_duration_milliseconds,
            untracked_duration_milliseconds: values.untracked_duration_milliseconds,
            apps: values.apps,
        };
        self.final_snapshot = Some(snapshot.clone());
        Ok(snapshot)
    }

    fn normalize_offset(offset_milliseconds: i128) -> Result<u64, AppUsageAccumulatorError> {
        if offset_milliseconds < 0 {
            return Err(AppUsageAccumulatorError::OffsetBeforeStart);
        }
        u64::try_from(offset_milliseconds).map_err(|_| AppUsageAccumulatorError::DurationOverflow)
    }

    fn credit_until(&mut self, offset_milliseconds: u64) -> Result<(), AppUsageAccumulatorError> {
        let elapsed = offset_milliseconds
            .checked_sub(self.last_observation_offset_milliseconds)
            .ok_or(AppUsageAccumulatorError::ClockMovedBackwards)?;
        if elapsed == 0 {
            return Ok(());
        }

        if elapsed > MAX_CREDITABLE_GAP_MILLISECONDS {
            self.untracked_duration_milliseconds = self
                .untracked_duration_milliseconds
                .checked_add(elapsed)
                .ok_or(AppUsageAccumulatorError::DurationOverflow)?;
            return Ok(());
        }

        match &self.active_bucket {
            ActiveBucket::Process(process_name) => {
                let previous = self.app_durations.get(process_name).copied().unwrap_or(0);
                let updated = previous
                    .checked_add(elapsed)
                    .ok_or(AppUsageAccumulatorError::DurationOverflow)?;
                self.app_durations.insert(process_name.clone(), updated);
            }
            ActiveBucket::Untracked => {
                self.untracked_duration_milliseconds = self
                    .untracked_duration_milliseconds
                    .checked_add(elapsed)
                    .ok_or(AppUsageAccumulatorError::DurationOverflow)?;
            }
        }
        Ok(())
    }

    fn running_snapshot(
        &self,
        captured_offset_milliseconds: u64,
    ) -> Result<RunningAppUsageSnapshot, AppUsageAccumulatorError> {
        let values = self.snapshot_values(captured_offset_milliseconds)?;
        Ok(RunningAppUsageSnapshot {
            captured_offset_milliseconds,
            duration_milliseconds: captured_offset_milliseconds,
            tracked_duration_milliseconds: values.tracked_duration_milliseconds,
            untracked_duration_milliseconds: values.untracked_duration_milliseconds,
            apps: values.apps,
        })
    }

    fn snapshot_values(
        &self,
        total_duration_milliseconds: u64,
    ) -> Result<SnapshotValues, AppUsageAccumulatorError> {
        let tracked_duration_milliseconds = self
            .app_durations
            .values()
            .try_fold(0_u64, |sum, duration| sum.checked_add(*duration))
            .ok_or(AppUsageAccumulatorError::DurationOverflow)?;
        let covered_duration_milliseconds = tracked_duration_milliseconds
            .checked_add(self.untracked_duration_milliseconds)
            .ok_or(AppUsageAccumulatorError::DurationOverflow)?;
        if tracked_duration_milliseconds > total_duration_milliseconds
            || covered_duration_milliseconds != total_duration_milliseconds
        {
            return Err(AppUsageAccumulatorError::InvariantViolation);
        }

        let apps = self
            .app_durations
            .iter()
            .map(
                |(process_name, duration_milliseconds)| RawTrackedAppDuration {
                    process_name: process_name.clone(),
                    duration_milliseconds: *duration_milliseconds,
                },
            )
            .collect();

        Ok(SnapshotValues {
            tracked_duration_milliseconds,
            untracked_duration_milliseconds: self.untracked_duration_milliseconds,
            apps,
        })
    }
}

struct SnapshotValues {
    tracked_duration_milliseconds: u64,
    untracked_duration_milliseconds: u64,
    apps: Vec<RawTrackedAppDuration>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn process(name: &str) -> ProcessObservation {
        ProcessObservation::Process(name.to_owned())
    }

    fn duration(snapshot: &FinalAppUsageSnapshot, name: &str) -> Option<u64> {
        snapshot
            .apps
            .iter()
            .find(|app| app.process_name == name)
            .map(|app| app.duration_milliseconds)
    }

    #[test]
    fn app_usage_accumulator_zero_length_session_is_empty() {
        let mut accumulator = AppUsageAccumulator::new();

        let snapshot = accumulator.finalize(0).unwrap();

        assert_eq!(snapshot.duration_milliseconds, 0);
        assert_eq!(snapshot.tracked_duration_milliseconds, 0);
        assert_eq!(snapshot.untracked_duration_milliseconds, 0);
        assert!(snapshot.apps.is_empty());
    }

    #[test]
    fn app_usage_accumulator_counts_initial_delay_as_untracked_and_subsecond_usage() {
        let mut accumulator = AppUsageAccumulator::new();
        accumulator.observe(125, process("editor.exe")).unwrap();

        let snapshot = accumulator.finalize(875).unwrap();

        assert_eq!(duration(&snapshot, "editor.exe"), Some(750));
        assert_eq!(snapshot.tracked_duration_milliseconds, 750);
        assert_eq!(snapshot.untracked_duration_milliseconds, 125);
    }

    #[test]
    fn app_usage_accumulator_keeps_counting_the_same_process() {
        let mut accumulator = AppUsageAccumulator::new();
        accumulator.observe(0, process("editor.exe")).unwrap();
        accumulator.observe(400, process("editor.exe")).unwrap();
        accumulator.observe(900, process("editor.exe")).unwrap();

        let snapshot = accumulator.finalize(1_000).unwrap();

        assert_eq!(duration(&snapshot, "editor.exe"), Some(1_000));
        assert_eq!(snapshot.untracked_duration_milliseconds, 0);
    }

    #[test]
    fn app_usage_accumulator_aggregates_rapid_a_b_a_switches_exclusively() {
        let mut accumulator = AppUsageAccumulator::new();
        accumulator.observe(0, process("A.exe")).unwrap();
        accumulator.observe(100, process("B.exe")).unwrap();
        accumulator.observe(225, process("A.exe")).unwrap();

        let snapshot = accumulator.finalize(300).unwrap();

        assert_eq!(duration(&snapshot, "A.exe"), Some(175));
        assert_eq!(duration(&snapshot, "B.exe"), Some(125));
        assert_eq!(snapshot.tracked_duration_milliseconds, 300);
        assert_eq!(snapshot.untracked_duration_milliseconds, 0);
        assert_eq!(
            snapshot.tracked_duration_milliseconds + snapshot.untracked_duration_milliseconds,
            snapshot.duration_milliseconds
        );
    }

    #[test]
    fn app_usage_accumulator_treats_null_error_and_self_as_untracked() {
        let mut accumulator = AppUsageAccumulator::new();
        accumulator
            .observe(0, ProcessObservation::NoForegroundWindow)
            .unwrap();
        accumulator
            .observe(100, ProcessObservation::ObservationFailed)
            .unwrap();
        accumulator
            .observe(200, ProcessObservation::SelfProcess)
            .unwrap();
        accumulator.observe(300, process("A.exe")).unwrap();

        let snapshot = accumulator.finalize(400).unwrap();

        assert_eq!(snapshot.untracked_duration_milliseconds, 300);
        assert_eq!(duration(&snapshot, "A.exe"), Some(100));
    }

    #[test]
    fn app_usage_accumulator_treats_a_long_gap_as_entirely_untracked() {
        let mut accumulator = AppUsageAccumulator::new();
        accumulator.observe(0, process("A.exe")).unwrap();
        accumulator.observe(5_001, process("B.exe")).unwrap();

        let snapshot = accumulator.finalize(5_101).unwrap();

        assert_eq!(duration(&snapshot, "A.exe"), None);
        assert_eq!(duration(&snapshot, "B.exe"), Some(100));
        assert_eq!(snapshot.untracked_duration_milliseconds, 5_001);
    }

    #[test]
    fn app_usage_accumulator_credits_a_gap_equal_to_the_threshold() {
        let mut accumulator = AppUsageAccumulator::new();
        accumulator.observe(0, process("A.exe")).unwrap();
        accumulator.observe(5_000, process("B.exe")).unwrap();

        let snapshot = accumulator.finalize(5_100).unwrap();

        assert_eq!(duration(&snapshot, "A.exe"), Some(5_000));
        assert_eq!(duration(&snapshot, "B.exe"), Some(100));
        assert_eq!(snapshot.untracked_duration_milliseconds, 0);
    }

    #[test]
    fn app_usage_accumulator_counts_the_final_active_process_until_stop() {
        let mut accumulator = AppUsageAccumulator::new();
        accumulator.observe(0, process("A.exe")).unwrap();
        accumulator.observe(400, process("B.exe")).unwrap();

        let snapshot = accumulator.finalize(1_000).unwrap();

        assert_eq!(duration(&snapshot, "A.exe"), Some(400));
        assert_eq!(duration(&snapshot, "B.exe"), Some(600));
    }

    #[test]
    fn app_usage_accumulator_finalization_is_idempotent_and_immutable() {
        let mut accumulator = AppUsageAccumulator::new();
        accumulator.observe(0, process("A.exe")).unwrap();

        let mut first = accumulator.finalize(100).unwrap();
        first.apps[0].duration_milliseconds = 999;
        let second = accumulator.finalize(999).unwrap();

        assert_eq!(second.ended_offset_milliseconds, 100);
        assert_eq!(duration(&second, "A.exe"), Some(100));
        assert_eq!(
            accumulator.observe(101, process("B.exe")),
            Err(AppUsageAccumulatorError::ObservationAfterFinalization)
        );
    }

    #[test]
    fn app_usage_accumulator_snapshot_does_not_mutate_internal_state() {
        let mut accumulator = AppUsageAccumulator::new();
        let mut source_name = String::from("Original.EXE");
        accumulator
            .observe(0, ProcessObservation::Process(source_name.clone()))
            .unwrap();
        source_name.make_ascii_lowercase();

        let mut first = accumulator.snapshot_at(100).unwrap();
        first.apps[0].process_name = "changed.exe".to_owned();
        first.apps[0].duration_milliseconds = 999;
        let second = accumulator.snapshot_at(100).unwrap();

        assert_eq!(second.apps[0].process_name, "Original.EXE");
        assert_eq!(second.apps[0].duration_milliseconds, 100);
        let final_snapshot = accumulator.finalize(200).unwrap();
        assert_eq!(duration(&final_snapshot, "Original.EXE"), Some(200));
    }

    #[test]
    fn app_usage_accumulator_keeps_raw_case_as_separate_process_keys() {
        let mut accumulator = AppUsageAccumulator::new();
        accumulator.observe(0, process("App.exe")).unwrap();
        accumulator.observe(100, process("app.exe")).unwrap();

        let snapshot = accumulator.finalize(200).unwrap();

        assert_eq!(duration(&snapshot, "App.exe"), Some(100));
        assert_eq!(duration(&snapshot, "app.exe"), Some(100));
    }

    #[test]
    fn app_usage_accumulator_reports_stable_time_errors() {
        let mut accumulator = AppUsageAccumulator::new();
        assert_eq!(
            accumulator.observe(-1, process("A.exe")),
            Err(AppUsageAccumulatorError::OffsetBeforeStart)
        );
        assert_eq!(
            AppUsageAccumulatorError::OffsetBeforeStart.code(),
            "OFFSET_BEFORE_START"
        );

        accumulator.observe(100, process("A.exe")).unwrap();
        assert_eq!(
            accumulator.observe(99, process("B.exe")),
            Err(AppUsageAccumulatorError::ClockMovedBackwards)
        );
        assert_eq!(
            accumulator.finalize(99),
            Err(AppUsageAccumulatorError::StopBeforeLastObservation)
        );

        let overflowing_offset = i128::from(u64::MAX) + 1;
        assert_eq!(
            accumulator.observe(overflowing_offset, process("B.exe")),
            Err(AppUsageAccumulatorError::DurationOverflow)
        );
    }
}
