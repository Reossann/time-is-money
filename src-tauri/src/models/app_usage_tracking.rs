//! アプリ利用時間の集計に使う、OS や Tauri に依存しないモデル。

/// ある時点で観測された前面プロセスの状態。
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcessObservation {
    /// 実行ファイルの basename を加工せず保持する。
    Process(String),
    /// 前面ウィンドウを取得できなかった。
    NoForegroundWindow,
    /// OS からの観測処理自体が失敗した。
    ObservationFailed,
    /// time-is-money 自身が前面にいた。
    SelfProcess,
}

/// プロセス単位で集計した利用時間。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawTrackedAppDuration {
    pub process_name: String,
    pub duration_milliseconds: u64,
}

/// 計測中に取得する、その時点までの利用時間スナップショット。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RunningAppUsageSnapshot {
    pub captured_offset_milliseconds: u64,
    pub duration_milliseconds: u64,
    pub tracked_duration_milliseconds: u64,
    pub untracked_duration_milliseconds: u64,
    pub apps: Vec<RawTrackedAppDuration>,
}

/// 計測終了時に確定する利用時間スナップショット。
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FinalAppUsageSnapshot {
    pub ended_offset_milliseconds: u64,
    pub duration_milliseconds: u64,
    pub tracked_duration_milliseconds: u64,
    pub untracked_duration_milliseconds: u64,
    pub apps: Vec<RawTrackedAppDuration>,
}
