import type { AppUsageLimitState, AppUsageObservation } from "../types/appUsageLimitState";

export function createInitialAppUsageLimitState(observation: AppUsageObservation): AppUsageLimitState {
  return {
    localDate: observation.localDate,
    lastCapturedAt: observation.capturedAt,
    activeAppId: observation.appId,
    continuousSeconds: 0,
    dailySecondsByAppId: {},
  };
}

/** Applies one foreground-app sample. Invalid or backwards samples leave state unchanged. */
export function advanceAppUsageLimitState(
  state: AppUsageLimitState,
  observation: AppUsageObservation,
): AppUsageLimitState {
  if (
    !Number.isFinite(observation.capturedAt) ||
    observation.capturedAt < state.lastCapturedAt ||
    observation.localDate.trim() === ""
  ) {
    return state;
  }

  if (observation.localDate !== state.localDate) {
    return {
      localDate: observation.localDate,
      lastCapturedAt: observation.capturedAt,
      activeAppId: observation.appId,
      continuousSeconds: 0,
      dailySecondsByAppId: {},
    };
  }

  const elapsedSeconds = Math.floor((observation.capturedAt - state.lastCapturedAt) / 1000);
  if (elapsedSeconds <= 0) return { ...state, lastCapturedAt: observation.capturedAt };

  const sameApp = observation.appId !== null && observation.appId === state.activeAppId;
  const dailySecondsByAppId = { ...state.dailySecondsByAppId };
  if (state.activeAppId !== null) {
    dailySecondsByAppId[state.activeAppId] =
      (dailySecondsByAppId[state.activeAppId] ?? 0) + elapsedSeconds;
  }

  return {
    ...state,
    lastCapturedAt: observation.capturedAt,
    activeAppId: observation.appId,
    continuousSeconds: sameApp ? state.continuousSeconds + elapsedSeconds : 0,
    dailySecondsByAppId,
  };
}
