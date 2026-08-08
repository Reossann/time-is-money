import { useCallback, useEffect } from "react";

import {
  removeSavedSessionRecord,
  retrySaveFinalizedSessionRecord,
  saveFinalizedSessionRecordOnce,
} from "../services/sessionRecordPersistenceController";
import { useSessionRecordSaveStore } from "../stores/useSessionRecordSaveStore";
import type {
  SessionRecordSaveErrorCode,
  SessionRecordSaveStatus,
} from "../types/sessionRecord";

export type UseSessionRecordPersistence = Readonly<{
  status: SessionRecordSaveStatus;
  errorCode: SessionRecordSaveErrorCode | null;
  savedSessionId: string | null;
  retry: () => void;
  remove: () => void;
}>;

/**
 * Drives one-time persistence of the finalized session result. Mounting this
 * hook (from the calendar-save step of the live result flow) triggers the save
 * exactly once; the controller enforces the idempotency and error state, which
 * this hook surfaces through the save store. Save failures never throw here — the
 * store carries the failure so the UI can offer a retry.
 */
export function useSessionRecordPersistence(): UseSessionRecordPersistence {
  const status = useSessionRecordSaveStore((state) => state.status);
  const errorCode = useSessionRecordSaveStore((state) => state.errorCode);
  const savedSessionId = useSessionRecordSaveStore(
    (state) => state.savedSessionId,
  );

  useEffect(() => {
    void saveFinalizedSessionRecordOnce().catch(() => {
      // Failure is reflected in the save store; nothing to handle here.
    });
  }, []);

  const retry = useCallback(() => {
    void retrySaveFinalizedSessionRecord().catch(() => {});
  }, []);

  const remove = useCallback(() => {
    void removeSavedSessionRecord().catch(() => {});
  }, []);

  return { status, errorCode, savedSessionId, retry, remove } as const;
}
