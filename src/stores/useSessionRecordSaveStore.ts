import { create } from "zustand";

import type {
  SessionRecordSaveErrorCode,
  SessionRecordSaveStatus,
} from "../types/sessionRecord";

type SessionRecordSaveState = {
  status: SessionRecordSaveStatus;
  errorCode: SessionRecordSaveErrorCode | null;
  savedSessionId: string | null;
  markSaving: () => void;
  markSaved: (sessionId: string) => void;
  markFailed: (errorCode: SessionRecordSaveErrorCode) => void;
  reset: () => void;
};

export const useSessionRecordSaveStore = create<SessionRecordSaveState>(
  (set) => ({
    status: "idle",
    errorCode: null,
    savedSessionId: null,
    markSaving: () => set({ status: "saving", errorCode: null }),
    markSaved: (sessionId) =>
      set({ status: "saved", errorCode: null, savedSessionId: sessionId }),
    markFailed: (errorCode) => set({ status: "failed", errorCode }),
    reset: () =>
      set({ status: "idle", errorCode: null, savedSessionId: null }),
  }),
);
