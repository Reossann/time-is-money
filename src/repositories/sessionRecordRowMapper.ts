import type { SessionAppResult } from "../types/sessionResult";
import type { SessionRecord } from "../types/sessionRecord";
import { sessionRecordSchema } from "../utils/sessionRecordSchemas";

export const SESSION_RECORD_DATABASE_PATH = "sqlite:timeismoney.db";

export type SessionRecordParentRow = Readonly<{
  session_id: string;
  schema_version: number;
  owner_id: string;
  started_at: number;
  ended_at: number;
  duration_seconds: number;
  tracked_duration_seconds: number;
  untracked_duration_seconds: number;
  earned_yen: number;
  wasted_yen: number;
  net_yen: number;
  local_date_key: string;
  created_at: number;
  updated_at: number;
  sync_status: string;
}>;

export type SessionRecordAppRow = Readonly<{
  session_id: string;
  app_id: string;
  process_name: string;
  duration_seconds: number;
  category: string | null;
  hourly_rate_yen: number;
  earned_yen: number;
  wasted_yen: number;
  net_yen: number;
}>;

/** Bind values for the parent upsert, in column order. */
export function toParentBindValues(record: SessionRecord): unknown[] {
  return [
    record.sessionId,
    record.schemaVersion,
    record.ownerId,
    record.startedAt,
    record.endedAt,
    record.durationSeconds,
    record.trackedDurationSeconds,
    record.untrackedDurationSeconds,
    record.totals.earnedYen,
    record.totals.wastedYen,
    record.totals.netYen,
    record.localDateKey,
    record.createdAt,
    record.updatedAt,
    record.syncStatus,
  ];
}

/** Bind values for one child app row, in column order. */
export function toAppBindValues(
  sessionId: string,
  app: SessionAppResult,
): unknown[] {
  return [
    sessionId,
    app.appId,
    app.processName,
    app.durationSeconds,
    app.category,
    app.hourlyRateYen,
    app.money.earnedYen,
    app.money.wastedYen,
    app.money.netYen,
  ];
}

/**
 * Rebuilds a validated, frozen {@link SessionRecord} from a parent row and its
 * child app rows. App rows must already be ordered by the query (duration
 * descending, appId ascending) so the record satisfies the schema invariants.
 * Throws if the stored rows fail validation.
 */
export function mapRowsToSessionRecord(
  parent: SessionRecordParentRow,
  appRows: readonly SessionRecordAppRow[],
): SessionRecord {
  const candidate = {
    schemaVersion: parent.schema_version,
    sessionId: parent.session_id,
    ownerId: parent.owner_id,
    startedAt: parent.started_at,
    endedAt: parent.ended_at,
    durationSeconds: parent.duration_seconds,
    trackedDurationSeconds: parent.tracked_duration_seconds,
    untrackedDurationSeconds: parent.untracked_duration_seconds,
    apps: appRows.map((row) => ({
      appId: row.app_id,
      processName: row.process_name,
      durationSeconds: row.duration_seconds,
      category: row.category,
      hourlyRateYen: row.hourly_rate_yen,
      money: {
        earnedYen: row.earned_yen,
        wastedYen: row.wasted_yen,
        netYen: row.net_yen,
      },
    })),
    totals: {
      earnedYen: parent.earned_yen,
      wastedYen: parent.wasted_yen,
      netYen: parent.net_yen,
    },
    localDateKey: parent.local_date_key,
    createdAt: parent.created_at,
    updatedAt: parent.updated_at,
    syncStatus: parent.sync_status,
  };

  const parsed = sessionRecordSchema.parse(candidate);
  return Object.freeze({
    ...parsed,
    apps: Object.freeze(
      parsed.apps.map((app) =>
        Object.freeze({ ...app, money: Object.freeze({ ...app.money }) }),
      ),
    ),
    totals: Object.freeze({ ...parsed.totals }),
  });
}
