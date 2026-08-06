import { create } from "zustand";

import {
  createRunningMeasurement,
  createStoppedMeasurement,
  generateSessionId,
  MeasurementLifecycleError,
  type SessionIdGenerator,
} from "../services/sessionResultService";
import type {
  MeasurementStatus,
  RunningMeasurement,
  StoppedMeasurement,
} from "../types/sessionResult";

type ActivityState = {
  elapsedSeconds: number;
  startedAt: number | null;
  sessionId: string | null;
  measurementStatus: MeasurementStatus;
  stoppedMeasurement: StoppedMeasurement | null;
  startMeasurement: (
    now?: number,
    generateId?: SessionIdGenerator,
  ) => RunningMeasurement;
  syncElapsed: (now?: number) => void;
  stopMeasurement: (now?: number) => StoppedMeasurement;
};

export const useActivityStore = create<ActivityState>((set, get) => ({
  elapsedSeconds: 0,
  startedAt: null,
  sessionId: null,
  measurementStatus: "idle",
  stoppedMeasurement: null,
  startMeasurement: (now, generateId = generateSessionId) => {
    const state = get();

    if (state.measurementStatus === "running") {
      if (state.sessionId === null || state.startedAt === null) {
        throw new MeasurementLifecycleError(
          "INCONSISTENT_MEASUREMENT_STATE",
          "running measurement must have a sessionId and startedAt",
        );
      }

      return Object.freeze({
        sessionId: state.sessionId,
        startedAt: state.startedAt,
      });
    }

    if (state.measurementStatus !== "idle") {
      throw new MeasurementLifecycleError(
        "INVALID_MEASUREMENT_TRANSITION",
        `cannot start a measurement while status is ${state.measurementStatus}`,
      );
    }

    const runningMeasurement = createRunningMeasurement(
      now ?? Date.now(),
      generateId,
    );

    set({
      elapsedSeconds: 0,
      startedAt: runningMeasurement.startedAt,
      sessionId: runningMeasurement.sessionId,
      measurementStatus: "running",
      stoppedMeasurement: null,
    });

    return runningMeasurement;
  },
  syncElapsed: (now = Date.now()) => {
    const { measurementStatus, startedAt } = get();

    if (measurementStatus !== "running" || startedAt === null) return;

    set({
      elapsedSeconds: Math.max(0, Math.floor((now - startedAt) / 1000)),
    });
  },
  stopMeasurement: (now) => {
    const state = get();

    if (state.stoppedMeasurement !== null) {
      return state.stoppedMeasurement;
    }

    if (
      state.measurementStatus !== "running" ||
      state.sessionId === null ||
      state.startedAt === null
    ) {
      throw new MeasurementLifecycleError(
        "MEASUREMENT_NOT_RUNNING",
        "cannot stop before a measurement starts",
      );
    }

    const stoppedMeasurement = createStoppedMeasurement(
      {
        sessionId: state.sessionId,
        startedAt: state.startedAt,
      },
      now ?? Date.now(),
    );

    set({
      elapsedSeconds: stoppedMeasurement.durationSeconds,
      measurementStatus: "stopped",
      stoppedMeasurement,
    });

    return stoppedMeasurement;
  },
}));
