import {
  createInMemorySessionRecordRepository,
  type SessionRecordRepository,
} from "../repositories/sessionRecordRepository";
import { useSessionRecordSaveStore } from "../stores/useSessionRecordSaveStore";
import type {
  SessionRecord,
  SessionRecordSaveErrorCode,
} from "../types/sessionRecord";
import type { SessionResult } from "../types/sessionResult";
import {
  ownerIdentityService,
  type OwnerIdentityService,
} from "./ownerIdentityService";
import {
  buildSessionRecord,
  type BuildSessionRecordInput,
} from "./sessionRecordService";
import {
  getFinalizedSessionResult,
  type FinalizedSessionResultState,
} from "./sessionFinalizationController";

export class SessionRecordPersistenceError extends Error {
  constructor(
    public readonly code: SessionRecordSaveErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionRecordPersistenceError";
  }
}

type ControllerDependencies = Readonly<{
  getFinalizedSessionResult: () => FinalizedSessionResultState;
  ownerIdentity: Pick<OwnerIdentityService, "getCurrentOwnerId">;
  repository: SessionRecordRepository;
  buildSessionRecord: (input: BuildSessionRecordInput) => SessionRecord;
  now: () => number;
}>;

type PersistenceState = {
  sessionId: string;
  savePromise: Promise<SessionRecord> | null;
  savedRecord: SessionRecord | null;
};

// Interim default: the in-memory repository keeps the app working before the
// SQLite-backed repository lands (#7 / task group 4). Swap this default there.
const defaultRepository = createInMemorySessionRecordRepository();

const defaultDependencies: ControllerDependencies = {
  getFinalizedSessionResult,
  ownerIdentity: ownerIdentityService,
  repository: defaultRepository,
  buildSessionRecord,
  now: () => Date.now(),
};

let dependencies = defaultDependencies;
let state: PersistenceState | null = null;

function createError(
  code: SessionRecordSaveErrorCode,
): SessionRecordPersistenceError {
  const messages: Record<SessionRecordSaveErrorCode, string> = {
    NOT_FINALIZED: "No finalized session result is available to save",
    OWNER_UNRESOLVED: "The record owner could not be resolved",
    INVALID_RECORD: "The session record could not be built",
    SAVE_FAILED: "The session record could not be saved",
  };
  return new SessionRecordPersistenceError(code, messages[code]);
}

function failActive(
  activeState: PersistenceState,
  code: SessionRecordSaveErrorCode,
): never {
  if (state === activeState) {
    activeState.savePromise = null;
    useSessionRecordSaveStore.getState().markFailed(code);
  }
  throw createError(code);
}

async function performSave(
  result: SessionResult,
  activeState: PersistenceState,
): Promise<SessionRecord> {
  let ownerId: string;
  try {
    ownerId = await dependencies.ownerIdentity.getCurrentOwnerId();
  } catch {
    return failActive(activeState, "OWNER_UNRESOLVED");
  }

  let record: SessionRecord;
  try {
    record = dependencies.buildSessionRecord({
      result,
      ownerId,
      now: dependencies.now(),
    });
  } catch {
    return failActive(activeState, "INVALID_RECORD");
  }

  let saved: SessionRecord;
  try {
    saved = await dependencies.repository.save(record);
  } catch {
    return failActive(activeState, "SAVE_FAILED");
  }

  if (state === activeState) {
    activeState.savedRecord = saved;
    activeState.savePromise = null;
    useSessionRecordSaveStore.getState().markSaved(saved.sessionId);
  }
  return saved;
}

/**
 * Saves the one finalized session result exactly once. Repeated calls for the
 * same session return the in-flight or completed save without writing again.
 * A different finalized session starts a fresh save.
 */
export function saveFinalizedSessionRecordOnce(): Promise<SessionRecord> {
  const finalized = dependencies.getFinalizedSessionResult();
  if (finalized.status !== "finalized") {
    useSessionRecordSaveStore.getState().markFailed("NOT_FINALIZED");
    return Promise.reject(createError("NOT_FINALIZED"));
  }

  if (state !== null && state.sessionId === finalized.result.sessionId) {
    if (state.savedRecord !== null) return Promise.resolve(state.savedRecord);
    if (state.savePromise !== null) return state.savePromise;
  }

  const activeState: PersistenceState = {
    sessionId: finalized.result.sessionId,
    savePromise: null,
    savedRecord: null,
  };
  state = activeState;

  useSessionRecordSaveStore.getState().markSaving();
  const savePromise = performSave(finalized.result, activeState);
  activeState.savePromise = savePromise;
  return savePromise;
}

/** Re-runs the save after a failure. */
export function retrySaveFinalizedSessionRecord(): Promise<SessionRecord> {
  return saveFinalizedSessionRecordOnce();
}

/** Undoes the just-saved record for the current session. */
export async function removeSavedSessionRecord(): Promise<void> {
  if (state === null || state.savedRecord === null) return;

  const record = state.savedRecord;
  await dependencies.repository.remove(record.sessionId, record.ownerId);

  if (state !== null && state.savedRecord === record) {
    state.savedRecord = null;
    state.savePromise = null;
  }
  useSessionRecordSaveStore.getState().reset();
}

export function resetSessionRecordPersistenceControllerForTests(): void {
  state = null;
  dependencies = defaultDependencies;
  useSessionRecordSaveStore.getState().reset();
}

export function configureSessionRecordPersistenceControllerForTests(
  overrides: Partial<ControllerDependencies>,
): void {
  dependencies = { ...defaultDependencies, ...overrides };
}
