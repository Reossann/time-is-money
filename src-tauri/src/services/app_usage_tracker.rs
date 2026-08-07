//! 前面processを定期観測し、session単位のaccumulatorを管理する。

use std::{
    error::Error,
    fmt,
    sync::{Arc, Mutex, MutexGuard},
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

use tauri::async_runtime::JoinHandle;
use tokio::time::{Interval, MissedTickBehavior};

use crate::{
    models::{FinalAppUsageSnapshot, ProcessObservation, RunningAppUsageSnapshot},
    platform::windows,
    services::app_usage_accumulator::{AppUsageAccumulator, AppUsageAccumulatorError},
};

pub const APP_USAGE_SAMPLE_INTERVAL: Duration = Duration::from_secs(1);

/// 前面process取得元の実装詳細をworkerから分離する小さなinterface。
pub trait ForegroundProcessSource: Send + Sync + 'static {
    fn foreground_process_name(&self) -> Result<Option<String>, ForegroundProcessSourceError>;
}

/// workerへOS errorの詳細を持ち込まないためのopaque error。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ForegroundProcessSourceError;

/// 実際のWindows APIを使うprocess source。
#[derive(Debug, Default)]
pub struct WindowsForegroundProcessSource;

impl ForegroundProcessSource for WindowsForegroundProcessSource {
    fn foreground_process_name(&self) -> Result<Option<String>, ForegroundProcessSourceError> {
        windows::get_foreground_process_name().map_err(|_| ForegroundProcessSourceError)
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppUsageTrackerInitializationError {
    CurrentExecutableUnavailable,
    InvalidCurrentExecutableName,
}

impl AppUsageTrackerInitializationError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::CurrentExecutableUnavailable => "CURRENT_EXECUTABLE_UNAVAILABLE",
            Self::InvalidCurrentExecutableName => "INVALID_CURRENT_EXECUTABLE_NAME",
        }
    }
}

impl fmt::Display for AppUsageTrackerInitializationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

impl Error for AppUsageTrackerInitializationError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AppUsageTrackerError {
    TrackingAlreadyRunning,
    SessionMismatch,
    StopBoundaryConflict,
    TrackingNotRunning,
    InvalidBoundary,
    Internal,
}

impl AppUsageTrackerError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::TrackingAlreadyRunning => "TRACKING_ALREADY_RUNNING",
            Self::SessionMismatch => "SESSION_MISMATCH",
            Self::StopBoundaryConflict => "STOP_BOUNDARY_CONFLICT",
            Self::TrackingNotRunning => "TRACKING_NOT_RUNNING",
            Self::InvalidBoundary => "INVALID_BOUNDARY",
            Self::Internal => "INTERNAL",
        }
    }
}

impl fmt::Display for AppUsageTrackerError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

impl Error for AppUsageTrackerError {}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StartTrackingOutcome {
    Started,
    AlreadyRunning,
    AlreadyFinalized,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunningTrackingSnapshot {
    pub session_id: String,
    pub started_at: i64,
    pub captured_at: i64,
    pub usage: RunningAppUsageSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinalTrackingSnapshot {
    pub session_id: String,
    pub started_at: i64,
    pub ended_at: i64,
    pub usage: FinalAppUsageSnapshot,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum TrackingSnapshot {
    Running(RunningTrackingSnapshot),
    Final(FinalTrackingSnapshot),
}

/// Tauri managed stateとして一つだけ登録するsession tracker。
pub struct AppUsageTracker {
    shared: Arc<Mutex<TrackerState>>,
    source: Arc<dyn ForegroundProcessSource>,
    self_process_name: Arc<str>,
    sample_interval: Duration,
}

impl AppUsageTracker {
    pub fn for_current_process() -> Result<Self, AppUsageTrackerInitializationError> {
        let process_name = current_executable_process_name()?;
        Self::new(Arc::new(WindowsForegroundProcessSource), process_name)
    }

    pub fn new(
        source: Arc<dyn ForegroundProcessSource>,
        self_process_name: String,
    ) -> Result<Self, AppUsageTrackerInitializationError> {
        Self::with_sample_interval(source, self_process_name, APP_USAGE_SAMPLE_INTERVAL)
    }

    fn with_sample_interval(
        source: Arc<dyn ForegroundProcessSource>,
        self_process_name: String,
        sample_interval: Duration,
    ) -> Result<Self, AppUsageTrackerInitializationError> {
        if self_process_name.is_empty() {
            return Err(AppUsageTrackerInitializationError::InvalidCurrentExecutableName);
        }

        Ok(Self {
            shared: Arc::new(Mutex::new(TrackerState::default())),
            source,
            self_process_name: Arc::from(self_process_name),
            sample_interval,
        })
    }

    pub fn start(
        &self,
        session_id: String,
        started_at: i64,
    ) -> Result<StartTrackingOutcome, AppUsageTrackerError> {
        self.start_internal(session_id, started_at, true)
    }

    pub fn snapshot(
        &self,
        session_id: &str,
        captured_at: i64,
    ) -> Result<TrackingSnapshot, AppUsageTrackerError> {
        let state = self.lock_state()?;
        match &state.lifecycle {
            TrackerLifecycle::Idle => Err(AppUsageTrackerError::TrackingNotRunning),
            TrackerLifecycle::Running(session) => {
                ensure_session_matches(&session.session_id, session_id)?;
                let offset = boundary_offset(session.started_at, captured_at)?;
                let usage = session
                    .accumulator
                    .snapshot_at(offset)
                    .map_err(map_accumulator_error)?;
                Ok(TrackingSnapshot::Running(RunningTrackingSnapshot {
                    session_id: session.session_id.clone(),
                    started_at: session.started_at,
                    captured_at,
                    usage,
                }))
            }
            TrackerLifecycle::Finalized(session) => {
                ensure_session_matches(&session.snapshot.session_id, session_id)?;
                Ok(TrackingSnapshot::Final(session.snapshot.clone()))
            }
        }
    }

    pub fn stop(
        &self,
        session_id: &str,
        ended_at: i64,
    ) -> Result<FinalTrackingSnapshot, AppUsageTrackerError> {
        let mut state = self.lock_state()?;
        match &mut state.lifecycle {
            TrackerLifecycle::Idle => Err(AppUsageTrackerError::TrackingNotRunning),
            TrackerLifecycle::Finalized(session) => {
                ensure_session_matches(&session.snapshot.session_id, session_id)?;
                if session.snapshot.ended_at != ended_at {
                    return Err(AppUsageTrackerError::StopBoundaryConflict);
                }
                Ok(session.snapshot.clone())
            }
            TrackerLifecycle::Running(session) => {
                ensure_session_matches(&session.session_id, session_id)?;
                let stop_offset = boundary_offset(session.started_at, ended_at)?;

                // Cloneして確定することで、boundary error時にrunning stateを壊さない。
                let mut accumulator = session.accumulator.clone();
                let usage = accumulator
                    .finalize(stop_offset)
                    .map_err(map_accumulator_error)?;
                let snapshot = FinalTrackingSnapshot {
                    session_id: session.session_id.clone(),
                    started_at: session.started_at,
                    ended_at,
                    usage,
                };
                let worker = session.worker.take();

                state.lifecycle = TrackerLifecycle::Finalized(FinalizedSession {
                    snapshot: snapshot.clone(),
                });
                if let Some(worker) = worker {
                    worker.abort();
                }

                Ok(snapshot)
            }
        }
    }

    fn start_internal(
        &self,
        session_id: String,
        started_at: i64,
        spawn_worker: bool,
    ) -> Result<StartTrackingOutcome, AppUsageTrackerError> {
        if session_id.trim().is_empty() || started_at < 0 {
            return Err(AppUsageTrackerError::InvalidBoundary);
        }

        let mut state = self.lock_state()?;
        match &state.lifecycle {
            TrackerLifecycle::Running(session) => {
                if session.session_id == session_id && session.started_at == started_at {
                    return Ok(StartTrackingOutcome::AlreadyRunning);
                }
                return Err(AppUsageTrackerError::TrackingAlreadyRunning);
            }
            TrackerLifecycle::Finalized(session)
                if session.snapshot.session_id == session_id
                    && session.snapshot.started_at == started_at =>
            {
                return Ok(StartTrackingOutcome::AlreadyFinalized);
            }
            TrackerLifecycle::Finalized(session) if session.snapshot.session_id == session_id => {
                return Err(AppUsageTrackerError::InvalidBoundary);
            }
            TrackerLifecycle::Idle | TrackerLifecycle::Finalized(_) => {}
        }

        let timing = WorkerTiming::new(started_at)?;
        let generation = state
            .next_generation
            .checked_add(1)
            .ok_or(AppUsageTrackerError::Internal)?;
        state.next_generation = generation;
        state.lifecycle = TrackerLifecycle::Running(RunningSession {
            session_id,
            started_at,
            generation,
            accumulator: AppUsageAccumulator::new(),
            worker: None,
        });

        if spawn_worker {
            let worker = spawn_tracking_worker(
                Arc::clone(&self.shared),
                Arc::clone(&self.source),
                Arc::clone(&self.self_process_name),
                generation,
                timing,
                self.sample_interval,
            );
            match &mut state.lifecycle {
                TrackerLifecycle::Running(session) if session.generation == generation => {
                    session.worker = Some(worker);
                }
                _ => worker.abort(),
            }
        }

        Ok(StartTrackingOutcome::Started)
    }

    fn lock_state(&self) -> Result<MutexGuard<'_, TrackerState>, AppUsageTrackerError> {
        self.shared
            .lock()
            .map_err(|_| AppUsageTrackerError::Internal)
    }
}

impl Drop for AppUsageTracker {
    fn drop(&mut self) {
        let Ok(mut state) = self.shared.lock() else {
            return;
        };
        if let TrackerLifecycle::Running(session) = &mut state.lifecycle {
            if let Some(worker) = session.worker.take() {
                worker.abort();
            }
        }
    }
}

#[derive(Default)]
struct TrackerState {
    next_generation: u64,
    lifecycle: TrackerLifecycle,
}

#[derive(Default)]
enum TrackerLifecycle {
    #[default]
    Idle,
    Running(RunningSession),
    Finalized(FinalizedSession),
}

struct RunningSession {
    session_id: String,
    started_at: i64,
    generation: u64,
    accumulator: AppUsageAccumulator,
    worker: Option<JoinHandle<()>>,
}

struct FinalizedSession {
    snapshot: FinalTrackingSnapshot,
}

#[derive(Clone, Copy)]
struct WorkerTiming {
    initial_offset_milliseconds: u64,
    monotonic_anchor: Instant,
}

impl WorkerTiming {
    fn new(started_at: i64) -> Result<Self, AppUsageTrackerError> {
        let now = current_epoch_milliseconds().map_err(|_| AppUsageTrackerError::Internal)?;
        let initial_offset_milliseconds = boundary_offset(started_at, now)?;
        let initial_offset_milliseconds = u64::try_from(initial_offset_milliseconds)
            .map_err(|_| AppUsageTrackerError::InvalidBoundary)?;
        Ok(Self {
            initial_offset_milliseconds,
            monotonic_anchor: Instant::now(),
        })
    }

    fn current_offset(self) -> Result<i128, AppUsageTrackerError> {
        let elapsed_milliseconds = self.monotonic_anchor.elapsed().as_millis();
        let offset = u128::from(self.initial_offset_milliseconds)
            .checked_add(elapsed_milliseconds)
            .ok_or(AppUsageTrackerError::Internal)?;
        i128::try_from(offset).map_err(|_| AppUsageTrackerError::Internal)
    }
}

fn spawn_tracking_worker(
    shared: Arc<Mutex<TrackerState>>,
    source: Arc<dyn ForegroundProcessSource>,
    self_process_name: Arc<str>,
    generation: u64,
    timing: WorkerTiming,
    sample_interval: Duration,
) -> JoinHandle<()> {
    tauri::async_runtime::spawn(async move {
        let mut interval = tracking_interval(sample_interval);
        loop {
            interval.tick().await;

            let source = Arc::clone(&source);
            let sample =
                tauri::async_runtime::spawn_blocking(move || source.foreground_process_name())
                    .await
                    .unwrap_or(Err(ForegroundProcessSourceError));
            let Ok(offset) = timing.current_offset() else {
                break;
            };

            if !apply_worker_sample(&shared, generation, offset, sample, &self_process_name) {
                break;
            }
        }
    })
}

fn tracking_interval(period: Duration) -> Interval {
    let mut interval = tokio::time::interval(period);
    interval.set_missed_tick_behavior(MissedTickBehavior::Skip);
    interval
}

fn apply_worker_sample(
    shared: &Arc<Mutex<TrackerState>>,
    generation: u64,
    offset_milliseconds: i128,
    sample: Result<Option<String>, ForegroundProcessSourceError>,
    self_process_name: &str,
) -> bool {
    let observation = process_observation(sample, self_process_name);
    let Ok(mut state) = shared.lock() else {
        return false;
    };
    let TrackerLifecycle::Running(session) = &mut state.lifecycle else {
        return false;
    };
    if session.generation != generation {
        return false;
    }

    session
        .accumulator
        .observe(offset_milliseconds, observation)
        .is_ok()
}

fn process_observation(
    sample: Result<Option<String>, ForegroundProcessSourceError>,
    self_process_name: &str,
) -> ProcessObservation {
    match sample {
        Ok(Some(process_name)) if process_name.eq_ignore_ascii_case(self_process_name) => {
            ProcessObservation::SelfProcess
        }
        Ok(Some(process_name)) if process_name.is_empty() => ProcessObservation::ObservationFailed,
        Ok(Some(process_name)) => ProcessObservation::Process(process_name),
        Ok(None) => ProcessObservation::NoForegroundWindow,
        Err(_) => ProcessObservation::ObservationFailed,
    }
}

fn current_executable_process_name() -> Result<String, AppUsageTrackerInitializationError> {
    let executable = std::env::current_exe()
        .map_err(|_| AppUsageTrackerInitializationError::CurrentExecutableUnavailable)?;
    executable
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| !name.is_empty())
        .map(ToOwned::to_owned)
        .ok_or(AppUsageTrackerInitializationError::InvalidCurrentExecutableName)
}

fn current_epoch_milliseconds() -> Result<i64, AppUsageTrackerInitializationError> {
    let milliseconds = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| AppUsageTrackerInitializationError::CurrentExecutableUnavailable)?
        .as_millis();
    i64::try_from(milliseconds)
        .map_err(|_| AppUsageTrackerInitializationError::CurrentExecutableUnavailable)
}

fn boundary_offset(started_at: i64, boundary: i64) -> Result<i128, AppUsageTrackerError> {
    if started_at < 0 || boundary < started_at {
        return Err(AppUsageTrackerError::InvalidBoundary);
    }
    Ok(i128::from(boundary) - i128::from(started_at))
}

fn ensure_session_matches(expected: &str, actual: &str) -> Result<(), AppUsageTrackerError> {
    if expected == actual {
        Ok(())
    } else {
        Err(AppUsageTrackerError::SessionMismatch)
    }
}

fn map_accumulator_error(error: AppUsageAccumulatorError) -> AppUsageTrackerError {
    match error {
        AppUsageAccumulatorError::OffsetBeforeStart
        | AppUsageAccumulatorError::ClockMovedBackwards
        | AppUsageAccumulatorError::StopBeforeLastObservation => {
            AppUsageTrackerError::InvalidBoundary
        }
        AppUsageAccumulatorError::ObservationAfterFinalization
        | AppUsageAccumulatorError::DurationOverflow
        | AppUsageAccumulatorError::InvariantViolation => AppUsageTrackerError::Internal,
    }
}

#[cfg(test)]
mod tests {
    use std::{
        sync::atomic::{AtomicUsize, Ordering},
        thread,
    };

    use super::*;

    struct CountingSource {
        calls: AtomicUsize,
        result: Mutex<Result<Option<String>, ForegroundProcessSourceError>>,
    }

    impl CountingSource {
        fn new(result: Result<Option<String>, ForegroundProcessSourceError>) -> Self {
            Self {
                calls: AtomicUsize::new(0),
                result: Mutex::new(result),
            }
        }

        fn call_count(&self) -> usize {
            self.calls.load(Ordering::SeqCst)
        }
    }

    impl ForegroundProcessSource for CountingSource {
        fn foreground_process_name(&self) -> Result<Option<String>, ForegroundProcessSourceError> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            self.result.lock().unwrap().clone()
        }
    }

    fn tracker(source: Arc<dyn ForegroundProcessSource>) -> AppUsageTracker {
        AppUsageTracker::new(source, "time-is-money.exe".to_owned()).unwrap()
    }

    fn start_without_worker(tracker: &AppUsageTracker, session_id: &str, started_at: i64) {
        assert_eq!(
            tracker
                .start_internal(session_id.to_owned(), started_at, false)
                .unwrap(),
            StartTrackingOutcome::Started
        );
    }

    fn running_generation(tracker: &AppUsageTracker) -> u64 {
        let state = tracker.shared.lock().unwrap();
        match &state.lifecycle {
            TrackerLifecycle::Running(session) => session.generation,
            _ => panic!("tracker must be running"),
        }
    }

    fn apply(
        tracker: &AppUsageTracker,
        generation: u64,
        offset: i128,
        sample: Result<Option<String>, ForegroundProcessSourceError>,
    ) -> bool {
        apply_worker_sample(
            &tracker.shared,
            generation,
            offset,
            sample,
            &tracker.self_process_name,
        )
    }

    fn app_duration(snapshot: &FinalTrackingSnapshot, process_name: &str) -> Option<u64> {
        snapshot
            .usage
            .apps
            .iter()
            .find(|app| app.process_name == process_name)
            .map(|app| app.duration_milliseconds)
    }

    fn wait_until(mut condition: impl FnMut() -> bool) {
        for _ in 0..100 {
            if condition() {
                return;
            }
            thread::sleep(Duration::from_millis(5));
        }
        panic!("condition was not met before timeout");
    }

    #[test]
    fn app_usage_tracker_interval_is_immediate_and_skips_missed_ticks() {
        tauri::async_runtime::block_on(async {
            let mut interval = tracking_interval(APP_USAGE_SAMPLE_INTERVAL);
            assert_eq!(interval.missed_tick_behavior(), MissedTickBehavior::Skip);
            tokio::time::timeout(Duration::from_millis(100), interval.tick())
                .await
                .expect("the first sample should run immediately");
        });
    }

    #[test]
    fn app_usage_tracker_start_is_idempotent_and_rejects_another_session() {
        let source = Arc::new(CountingSource::new(Ok(None)));
        let tracker = tracker(source);
        start_without_worker(&tracker, "session-a", 1_000);

        assert_eq!(
            tracker
                .start_internal("session-a".to_owned(), 1_000, false)
                .unwrap(),
            StartTrackingOutcome::AlreadyRunning
        );
        assert_eq!(
            tracker.start_internal("session-b".to_owned(), 1_000, false),
            Err(AppUsageTrackerError::TrackingAlreadyRunning)
        );
        assert_eq!(
            tracker.snapshot("session-b", 1_100),
            Err(AppUsageTrackerError::SessionMismatch)
        );
    }

    #[test]
    fn app_usage_tracker_preview_is_a_clone_and_does_not_double_count() {
        let source = Arc::new(CountingSource::new(Ok(None)));
        let tracker = tracker(source);
        start_without_worker(&tracker, "session-a", 1_000);
        let generation = running_generation(&tracker);
        assert!(apply(
            &tracker,
            generation,
            0,
            Ok(Some("Editor.EXE".to_owned()))
        ));

        let TrackingSnapshot::Running(mut first) = tracker.snapshot("session-a", 1_100).unwrap()
        else {
            panic!("running preview expected");
        };
        first.usage.apps[0].duration_milliseconds = 999;
        let TrackingSnapshot::Running(second) = tracker.snapshot("session-a", 1_200).unwrap()
        else {
            panic!("running preview expected");
        };

        assert_eq!(second.usage.apps[0].process_name, "Editor.EXE");
        assert_eq!(second.usage.apps[0].duration_milliseconds, 200);
        assert_eq!(second.usage.tracked_duration_milliseconds, 200);
    }

    #[test]
    fn app_usage_tracker_stop_is_idempotent_and_ignores_late_samples() {
        let source = Arc::new(CountingSource::new(Ok(None)));
        let tracker = tracker(source);
        start_without_worker(&tracker, "session-a", 1_000);
        let generation = running_generation(&tracker);
        assert!(apply(&tracker, generation, 0, Ok(Some("A.exe".to_owned()))));

        let first = tracker.stop("session-a", 1_100).unwrap();
        assert!(!apply(
            &tracker,
            generation,
            200,
            Ok(Some("late.exe".to_owned()))
        ));
        let second = tracker.stop("session-a", 1_100).unwrap();

        assert_eq!(second, first);
        assert_eq!(app_duration(&second, "A.exe"), Some(100));
        assert_eq!(app_duration(&second, "late.exe"), None);
        assert_eq!(
            tracker.stop("session-a", 1_200),
            Err(AppUsageTrackerError::StopBoundaryConflict)
        );
        assert_eq!(
            tracker.stop("session-b", 1_100),
            Err(AppUsageTrackerError::SessionMismatch)
        );
        assert_eq!(
            tracker.snapshot("session-a", 9_999).unwrap(),
            TrackingSnapshot::Final(first)
        );
    }

    #[test]
    fn app_usage_tracker_keeps_sampling_after_source_errors_and_excludes_self() {
        let source = Arc::new(CountingSource::new(Ok(None)));
        let tracker = tracker(source);
        start_without_worker(&tracker, "session-a", 1_000);
        let generation = running_generation(&tracker);

        assert!(apply(&tracker, generation, 0, Ok(Some("A.exe".to_owned()))));
        assert!(apply(
            &tracker,
            generation,
            100,
            Err(ForegroundProcessSourceError)
        ));
        assert!(apply(
            &tracker,
            generation,
            200,
            Ok(Some("TIME-IS-MONEY.EXE".to_owned()))
        ));
        assert!(apply(&tracker, generation, 300, Ok(None)));

        let snapshot = tracker.stop("session-a", 1_400).unwrap();
        assert_eq!(app_duration(&snapshot, "A.exe"), Some(100));
        assert_eq!(snapshot.usage.untracked_duration_milliseconds, 300);
        assert_eq!(snapshot.usage.apps.len(), 1);
    }

    #[test]
    fn app_usage_tracker_worker_samples_immediately_and_stops_without_leaking() {
        let source = Arc::new(CountingSource::new(Ok(Some("A.exe".to_owned()))));
        let tracker = AppUsageTracker::with_sample_interval(
            source.clone(),
            "time-is-money.exe".to_owned(),
            Duration::from_millis(20),
        )
        .unwrap();
        let started_at = current_epoch_milliseconds().unwrap();

        assert_eq!(
            tracker.start("session-a".to_owned(), started_at).unwrap(),
            StartTrackingOutcome::Started
        );
        wait_until(|| source.call_count() >= 1);
        tracker.stop("session-a", started_at + 1_000).unwrap();
        let calls_after_stop = source.call_count();
        thread::sleep(Duration::from_millis(80));

        assert_eq!(source.call_count(), calls_after_stop);
    }

    #[test]
    fn app_usage_tracker_drop_cancels_the_worker() {
        let source = Arc::new(CountingSource::new(Ok(None)));
        let tracker = AppUsageTracker::with_sample_interval(
            source.clone(),
            "time-is-money.exe".to_owned(),
            Duration::from_millis(20),
        )
        .unwrap();
        let started_at = current_epoch_milliseconds().unwrap();
        tracker.start("session-a".to_owned(), started_at).unwrap();
        wait_until(|| source.call_count() >= 1);

        drop(tracker);
        thread::sleep(Duration::from_millis(40));
        let settled_calls = source.call_count();
        thread::sleep(Duration::from_millis(80));

        assert_eq!(source.call_count(), settled_calls);
    }
}
