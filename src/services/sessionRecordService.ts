import {
  SESSION_RECORD_SCHEMA_VERSION,
  type SessionRecord,
  type SessionRecordSyncStatus,
} from "../types/sessionRecord";
import type { SessionAppResult, SessionResult } from "../types/sessionResult";
import { toLocalDateKey } from "../utils/localDate";
import { sessionRecordSchema } from "../utils/sessionRecordSchemas";

export type SessionRecordBuildErrorCode =
  | "INVALID_OWNER_ID"
  | "INVALID_TIMESTAMP"
  | "INVALID_RECORD";

export class SessionRecordBuildError extends Error {
  constructor(
    public readonly code: SessionRecordBuildErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionRecordBuildError";
  }
}

export type BuildSessionRecordInput = Readonly<{
  /** The one finalized result produced by the finalization controller. */
  result: SessionResult;
  ownerId: string;
  /** Unix epoch milliseconds used for createdAt and updatedAt. */
  now: number;
  /** Defaults to "local-only". */
  syncStatus?: SessionRecordSyncStatus;
}>;

function freezeApps(
  apps: ReadonlyArray<SessionAppResult>,
): ReadonlyArray<SessionAppResult> {
  return Object.freeze(
    apps.map((app) =>
      Object.freeze({ ...app, money: Object.freeze({ ...app.money }) }),
    ),
  );
}

/**
 * Builds the persistable {@link SessionRecord} from a finalized result. The
 * finalized result is the single source of truth; this function never
 * recomputes durations or money. Validation runs through sessionRecordSchema so
 * a malformed record can never reach the repository boundary.
 */
export function buildSessionRecord(
  input: BuildSessionRecordInput,
): SessionRecord {
  const { result, ownerId, now, syncStatus = "local-only" } = input;

  if (ownerId.trim().length === 0) {
    throw new SessionRecordBuildError(
      "INVALID_OWNER_ID",
      "ownerId must not be empty",
    );
  }
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new SessionRecordBuildError(
      "INVALID_TIMESTAMP",
      "now must be a non-negative safe integer",
    );
  }

  let localDateKey: string;
  try {
    localDateKey = toLocalDateKey(result.endedAt);
  } catch {
    throw new SessionRecordBuildError(
      "INVALID_TIMESTAMP",
      "endedAt cannot derive a local date key",
    );
  }

  const candidate = {
    schemaVersion: SESSION_RECORD_SCHEMA_VERSION,
    sessionId: result.sessionId,
    ownerId,
    startedAt: result.startedAt,
    endedAt: result.endedAt,
    durationSeconds: result.durationSeconds,
    trackedDurationSeconds: result.trackedDurationSeconds,
    untrackedDurationSeconds: result.untrackedDurationSeconds,
    apps: result.apps,
    totals: { ...result.totals },
    localDateKey,
    createdAt: now,
    updatedAt: now,
    syncStatus,
  };

  let parsed: SessionRecord;
  try {
    parsed = sessionRecordSchema.parse(candidate);
  } catch {
    throw new SessionRecordBuildError(
      "INVALID_RECORD",
      "session record failed validation",
    );
  }

  return Object.freeze({
    ...parsed,
    apps: freezeApps(parsed.apps),
    totals: Object.freeze({ ...parsed.totals }),
  });
}
