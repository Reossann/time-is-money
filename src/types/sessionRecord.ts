import type { MoneyBreakdown } from "./money";
import type { SessionAppResult } from "./sessionResult";

export const SESSION_RECORD_SCHEMA_VERSION = 1 as const;

/**
 * Persistence-level sync state. `local-only` is the sole value produced today;
 * the remaining values reserve room for the #29 account/sync work so the schema
 * does not need a later migration.
 */
export type SessionRecordSyncStatus = "local-only" | "pending-sync" | "synced";

/**
 * The stored shape of one finalized session. It embeds the immutable
 * {@link SessionResult} payload and adds ownership, calendar, and sync fields.
 * `sessionId` is the primary key and the idempotency key for saving.
 */
export type SessionRecord = Readonly<{
  schemaVersion: typeof SESSION_RECORD_SCHEMA_VERSION;
  sessionId: string;
  /** Owner of the record. A local owner id until #29 introduces accounts. */
  ownerId: string;
  /** Unix epoch milliseconds. */
  startedAt: number;
  /** Unix epoch milliseconds, fixed by the first stop request. */
  endedAt: number;
  durationSeconds: number;
  trackedDurationSeconds: number;
  untrackedDurationSeconds: number;
  apps: ReadonlyArray<SessionAppResult>;
  totals: MoneyBreakdown;
  /** Local-timezone calendar day derived from endedAt, "YYYY-MM-DD". */
  localDateKey: string;
  /** Unix epoch milliseconds when the record was first persisted. */
  createdAt: number;
  /** Unix epoch milliseconds of the latest persist. */
  updatedAt: number;
  syncStatus: SessionRecordSyncStatus;
}>;

export type SessionRecordSaveStatus = "idle" | "saving" | "saved" | "failed";

export type SessionRecordSaveErrorCode =
  | "NOT_FINALIZED"
  | "OWNER_UNRESOLVED"
  | "INVALID_RECORD"
  | "SAVE_FAILED";
