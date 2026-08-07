import { useEffect, useSyncExternalStore } from "react";

import {
  getAppUsageTrackingErrorCode,
  getAppUsageTrackingSnapshot,
  startAppUsageTracking,
  stopAppUsageTracking,
  type AppUsageTrackingErrorCode,
} from "../services/appUsageTrackingService";
import { useActivityStore } from "../stores/useActivityStore";
import type { AppUsageSnapshot } from "../types/appUsageTracking";
import type { RunningMeasurement } from "../types/sessionResult";

export type MeasurementTrackingStatus =
  | "idle"
  | "starting"
  | "tracking"
  | "stopping"
  | "stopped"
  | "start-failed"
  | "stop-failed";

export type MeasurementTrackingState = Readonly<{
  status: MeasurementTrackingStatus;
  snapshot: AppUsageSnapshot | null;
  errorCode: AppUsageTrackingErrorCode | null;
}>;

type TrackingController = {
  measurement: RunningMeasurement;
  startPromise: Promise<void>;
  previewPromise: Promise<AppUsageSnapshot> | null;
  stopPromise: Promise<AppUsageSnapshot> | null;
  finalSnapshot: AppUsageSnapshot | null;
};

const idleState: MeasurementTrackingState = Object.freeze({
  status: "idle",
  snapshot: null,
  errorCode: null,
});

let trackingState = idleState;
let controller: TrackingController | null = null;
const listeners = new Set<() => void>();

function publishState(nextState: MeasurementTrackingState): void {
  trackingState = Object.freeze(nextState);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function isSnapshotForMeasurement(
  snapshot: AppUsageSnapshot,
  measurement: RunningMeasurement,
): boolean {
  return (
    snapshot.sessionId === measurement.sessionId &&
    snapshot.startedAt === measurement.startedAt
  );
}

export function getMeasurementTrackingState(): MeasurementTrackingState {
  return trackingState;
}

export function useMeasurementTrackingState(): MeasurementTrackingState {
  return useSyncExternalStore(
    subscribe,
    getMeasurementTrackingState,
    getMeasurementTrackingState,
  );
}

/**
 * frontend measurementを開始し、同じidentityでRust trackerを一度だけ開始する。
 * controllerはReact lifecycleの外にあるため、StrictModeや画面遷移でresetされない。
 */
export function ensureMeasurementTrackingStarted(): Promise<void> {
  const measurement = useActivityStore.getState().startMeasurement();

  if (controller !== null) {
    if (
      controller.measurement.sessionId !== measurement.sessionId ||
      controller.measurement.startedAt !== measurement.startedAt
    ) {
      publishState({
        ...trackingState,
        status: "start-failed",
        errorCode: "SESSION_MISMATCH",
      });
      return Promise.reject(
        Object.freeze({ code: "SESSION_MISMATCH" as const }),
      );
    }
    return controller.startPromise;
  }

  publishState({ status: "starting", snapshot: null, errorCode: null });

  const nextController: TrackingController = {
    measurement,
    startPromise: Promise.resolve(),
    previewPromise: null,
    stopPromise: null,
    finalSnapshot: null,
  };
  controller = nextController;

  nextController.startPromise = startAppUsageTracking(
    measurement.sessionId,
    measurement.startedAt,
  ).then(
    () => {
      if (controller === nextController) {
        publishState({ status: "tracking", snapshot: null, errorCode: null });
      }
    },
    (error: unknown) => {
      if (controller === nextController) {
        publishState({
          status: "start-failed",
          snapshot: null,
          errorCode: getAppUsageTrackingErrorCode(error),
        });
      }
      throw error;
    },
  );

  return nextController.startPromise;
}

/** 表示用snapshotを取得する。呼び出し中のrefreshは一つのPromiseへまとめる。 */
export function refreshAppUsageTrackingSnapshot(
  capturedAt: number = Date.now(),
): Promise<AppUsageSnapshot> {
  const activeController = controller;
  if (activeController === null) {
    return Promise.reject(
      Object.freeze({ code: "TRACKING_NOT_RUNNING" as const }),
    );
  }
  if (activeController.finalSnapshot !== null) {
    return Promise.resolve(activeController.finalSnapshot);
  }
  if (activeController.previewPromise !== null) {
    return activeController.previewPromise;
  }

  const previewPromise = activeController.startPromise.then(() =>
    getAppUsageTrackingSnapshot(
      activeController.measurement.sessionId,
      capturedAt,
    ),
  );
  activeController.previewPromise = previewPromise;

  void previewPromise.then(
    (snapshot) => {
      if (controller === activeController) {
        activeController.previewPromise = null;
        if (
          trackingState.status !== "tracking" ||
          activeController.stopPromise !== null ||
          activeController.finalSnapshot !== null
        ) {
          return;
        }
        if (!isSnapshotForMeasurement(snapshot, activeController.measurement)) {
          publishState({
            ...trackingState,
            errorCode: "INTERNAL",
          });
          return;
        }
        publishState({ ...trackingState, snapshot, errorCode: null });
      }
    },
    (error: unknown) => {
      if (controller === activeController) {
        activeController.previewPromise = null;
        if (trackingState.status !== "tracking") return;
        publishState({
          ...trackingState,
          errorCode: getAppUsageTrackingErrorCode(error),
        });
      }
    },
  );

  return previewPromise;
}

/**
 * frontendとRust trackerを同じ最初のendedAtで停止する公開adapter。
 * 連打は同じPromiseを共有し、失敗時は固定済み境界のまま再試行できる。
 */
export function stopAndSnapshotAppUsage(
  endedAt?: number,
): Promise<AppUsageSnapshot> {
  const stoppedMeasurement = useActivityStore
    .getState()
    .stopMeasurement(endedAt);
  const activeController = controller;

  if (
    activeController === null ||
    activeController.measurement.sessionId !== stoppedMeasurement.sessionId ||
    activeController.measurement.startedAt !== stoppedMeasurement.startedAt
  ) {
    publishState({
      ...trackingState,
      status: "stop-failed",
      errorCode: "SESSION_MISMATCH",
    });
    return Promise.reject(Object.freeze({ code: "SESSION_MISMATCH" as const }));
  }
  if (activeController.finalSnapshot !== null) {
    return Promise.resolve(activeController.finalSnapshot);
  }
  if (activeController.stopPromise !== null) {
    return activeController.stopPromise;
  }

  publishState({ ...trackingState, status: "stopping", errorCode: null });
  const stopPromise = activeController.startPromise
    .then(() =>
      stopAppUsageTracking(
        stoppedMeasurement.sessionId,
        stoppedMeasurement.endedAt,
      ),
    )
    .then((snapshot) => {
      if (
        !isSnapshotForMeasurement(snapshot, activeController.measurement) ||
        snapshot.capturedAt !== stoppedMeasurement.endedAt
      ) {
        throw Object.freeze({ code: "INTERNAL" as const });
      }
      return snapshot;
    });
  activeController.stopPromise = stopPromise;

  void stopPromise.then(
    (snapshot) => {
      if (controller === activeController) {
        activeController.finalSnapshot = snapshot;
        publishState({ status: "stopped", snapshot, errorCode: null });
      }
    },
    (error: unknown) => {
      if (controller === activeController) {
        activeController.stopPromise = null;
        publishState({
          ...trackingState,
          status: "stop-failed",
          errorCode: getAppUsageTrackingErrorCode(error),
        });
      }
    },
  );

  return stopPromise;
}

export function useMeasurementTracking(): MeasurementTrackingState {
  const state = useMeasurementTrackingState();

  useEffect(() => {
    void ensureMeasurementTrackingStarted().catch(() => undefined);

    const intervalId = window.setInterval(() => {
      useActivityStore.getState().syncElapsed();
    }, 1_000);

    return () => window.clearInterval(intervalId);
  }, []);

  return state;
}

/** Test境界でmodule singletonだけを初期状態へ戻す。 */
export function resetMeasurementTrackingControllerForTests(): void {
  controller = null;
  publishState(idleState);
}
