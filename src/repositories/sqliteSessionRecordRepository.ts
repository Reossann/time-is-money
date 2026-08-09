import type { SessionRecord } from "../types/sessionRecord";
import { sessionRecordSchema } from "../utils/sessionRecordSchemas";
import {
  createSessionRecordRepositoryError,
  SessionRecordRepositoryError,
  type SessionRecordRepository,
} from "./sessionRecordRepository";
import {
  mapRowsToSessionRecord,
  SESSION_RECORD_DATABASE_PATH,
  toAppBindValues,
  toParentBindValues,
  type SessionRecordAppRow,
  type SessionRecordParentRow,
} from "./sessionRecordRowMapper";

/** Minimal surface of the @tauri-apps/plugin-sql Database used by the repo. */
export interface SqlDatabase {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

export type SqlDatabaseProvider = () => Promise<SqlDatabase>;

const createError = createSessionRecordRepositoryError;

export const SESSION_RECORD_SQL = {
  selectOwner: "SELECT owner_id FROM session_records WHERE session_id = $1",
  upsertParent: `INSERT INTO session_records (
      session_id, schema_version, owner_id, started_at, ended_at,
      duration_seconds, tracked_duration_seconds, untracked_duration_seconds,
      earned_yen, wasted_yen, net_yen, local_date_key, created_at, updated_at, sync_status
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    ON CONFLICT(session_id) DO UPDATE SET
      schema_version = excluded.schema_version,
      owner_id = excluded.owner_id,
      started_at = excluded.started_at,
      ended_at = excluded.ended_at,
      duration_seconds = excluded.duration_seconds,
      tracked_duration_seconds = excluded.tracked_duration_seconds,
      untracked_duration_seconds = excluded.untracked_duration_seconds,
      earned_yen = excluded.earned_yen,
      wasted_yen = excluded.wasted_yen,
      net_yen = excluded.net_yen,
      local_date_key = excluded.local_date_key,
      updated_at = excluded.updated_at,
      sync_status = excluded.sync_status`,
  deleteApps: "DELETE FROM session_record_apps WHERE session_id = $1",
  insertApp: `INSERT INTO session_record_apps (
      session_id, app_id, process_name, duration_seconds, category,
      hourly_rate_yen, earned_yen, wasted_yen, net_yen
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
  selectParentById: "SELECT * FROM session_records WHERE session_id = $1",
  selectAppsById:
    "SELECT * FROM session_record_apps WHERE session_id = $1 ORDER BY duration_seconds DESC, app_id ASC",
  selectByOwner:
    "SELECT * FROM session_records WHERE owner_id = $1 ORDER BY ended_at DESC, session_id ASC",
  selectByOwnerInRange:
    "SELECT * FROM session_records WHERE owner_id = $1 AND ended_at >= $2 AND ended_at < $3 ORDER BY ended_at DESC, session_id ASC LIMIT $4",
  selectByDate:
    "SELECT * FROM session_records WHERE owner_id = $1 AND local_date_key = $2 ORDER BY ended_at DESC, session_id ASC",
  selectByApp: `SELECT sr.* FROM session_records sr
      JOIN session_record_apps a ON a.session_id = sr.session_id
      WHERE sr.owner_id = $1 AND a.app_id = $2
      ORDER BY sr.ended_at DESC, sr.session_id ASC`,
  deleteParent: "DELETE FROM session_records WHERE session_id = $1",
} as const;

let databasePromise: Promise<SqlDatabase> | undefined;

const defaultProvideDatabase: SqlDatabaseProvider = () => {
  // Lazy dynamic import keeps the native plugin out of non-Tauri contexts
  // (e.g. the vitest environment) until a real save actually needs it.
  databasePromise ??= import("@tauri-apps/plugin-sql").then(({ default: Database }) =>
    Database.load(SESSION_RECORD_DATABASE_PATH),
  );
  return databasePromise;
};

function canonicalizeRecord(value: unknown): SessionRecord {
  const parsed = sessionRecordSchema.parse(value);
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

function rethrow(
  error: unknown,
  fallbackCode: "LOAD_FAILED" | "SAVE_FAILED" | "REMOVE_FAILED",
): never {
  if (error instanceof SessionRecordRepositoryError) throw error;
  throw createError(fallbackCode);
}

/**
 * SQLite-backed repository via @tauri-apps/plugin-sql. Note: tauri-plugin-sql
 * runs each statement on a pooled connection, so save() applies its statements
 * sequentially rather than in one transaction. The parent upsert is the source
 * of truth for existence and every write is idempotent, so a re-save fully
 * repairs any partial child-table state.
 */
export class SqliteSessionRecordRepository implements SessionRecordRepository {
  private saveQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly provideDatabase: SqlDatabaseProvider = defaultProvideDatabase,
  ) {}

  save(record: SessionRecord): Promise<SessionRecord> {
    let canonical: SessionRecord;
    try {
      canonical = canonicalizeRecord(record);
    } catch {
      return Promise.reject(createError("INVALID_RECORD"));
    }

    const operation = this.saveQueue
      .then(async () => {
        const db = await this.provideDatabase();

        const existing = await db.select<Array<{ owner_id: string }>>(
          SESSION_RECORD_SQL.selectOwner,
          [canonical.sessionId],
        );
        if (existing.length > 0 && existing[0].owner_id !== canonical.ownerId) {
          throw createError("OWNER_MISMATCH");
        }

        await db.execute(
          SESSION_RECORD_SQL.upsertParent,
          toParentBindValues(canonical),
        );
        await db.execute(SESSION_RECORD_SQL.deleteApps, [canonical.sessionId]);
        for (const app of canonical.apps) {
          await db.execute(
            SESSION_RECORD_SQL.insertApp,
            toAppBindValues(canonical.sessionId, app),
          );
        }
        return canonical;
      })
      .catch((error: unknown) => rethrow(error, "SAVE_FAILED"));

    this.saveQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  async getBySessionId(sessionId: string): Promise<SessionRecord | null> {
    try {
      const db = await this.provideDatabase();
      const parents = await db.select<SessionRecordParentRow[]>(
        SESSION_RECORD_SQL.selectParentById,
        [sessionId],
      );
      if (parents.length === 0) return null;
      return await this.hydrateOne(db, parents[0]);
    } catch (error) {
      return rethrow(error, "LOAD_FAILED");
    }
  }

  async listByDate(
    ownerId: string,
    localDateKey: string,
  ): Promise<readonly SessionRecord[]> {
    try {
      const db = await this.provideDatabase();
      const parents = await db.select<SessionRecordParentRow[]>(
        SESSION_RECORD_SQL.selectByDate,
        [ownerId, localDateKey],
      );
      return await this.hydrateMany(db, parents);
    } catch (error) {
      return rethrow(error, "LOAD_FAILED");
    }
  }

  async listByApp(
    ownerId: string,
    appId: string,
  ): Promise<readonly SessionRecord[]> {
    try {
      const db = await this.provideDatabase();
      const parents = await db.select<SessionRecordParentRow[]>(
        SESSION_RECORD_SQL.selectByApp,
        [ownerId, appId],
      );
      return await this.hydrateMany(db, parents);
    } catch (error) {
      return rethrow(error, "LOAD_FAILED");
    }
  }

  async listByOwner(ownerId: string): Promise<readonly SessionRecord[]> {
    try {
      const db = await this.provideDatabase();
      const parents = await db.select<SessionRecordParentRow[]>(
        SESSION_RECORD_SQL.selectByOwner,
        [ownerId],
      );
      return await this.hydrateMany(db, parents);
    } catch (error) {
      return rethrow(error, "LOAD_FAILED");
    }
  }

  async listByOwnerInRange(
    ownerId: string,
    fromMs: number,
    toMs: number,
    limit: number,
  ): Promise<readonly SessionRecord[]> {
    try {
      const db = await this.provideDatabase();
      const parents = await db.select<SessionRecordParentRow[]>(
        SESSION_RECORD_SQL.selectByOwnerInRange,
        [ownerId, fromMs, toMs, limit],
      );
      return await this.hydrateMany(db, parents);
    } catch (error) {
      return rethrow(error, "LOAD_FAILED");
    }
  }

  remove(sessionId: string, ownerId: string): Promise<void> {
    const operation = this.saveQueue
      .then(async () => {
        const db = await this.provideDatabase();
        const existing = await db.select<Array<{ owner_id: string }>>(
          SESSION_RECORD_SQL.selectOwner,
          [sessionId],
        );
        if (existing.length === 0) return;
        if (existing[0].owner_id !== ownerId) {
          throw createError("OWNER_MISMATCH");
        }
        await db.execute(SESSION_RECORD_SQL.deleteApps, [sessionId]);
        await db.execute(SESSION_RECORD_SQL.deleteParent, [sessionId]);
      })
      .catch((error: unknown) => rethrow(error, "REMOVE_FAILED"));

    this.saveQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private async hydrateOne(
    db: SqlDatabase,
    parent: SessionRecordParentRow,
  ): Promise<SessionRecord> {
    const appRows = await db.select<SessionRecordAppRow[]>(
      SESSION_RECORD_SQL.selectAppsById,
      [parent.session_id],
    );
    try {
      return mapRowsToSessionRecord(parent, appRows);
    } catch {
      throw createError("INVALID_STORED_RECORD");
    }
  }

  private async hydrateMany(
    db: SqlDatabase,
    parents: readonly SessionRecordParentRow[],
  ): Promise<SessionRecord[]> {
    const records: SessionRecord[] = [];
    for (const parent of parents) {
      records.push(await this.hydrateOne(db, parent));
    }
    return records;
  }
}

export function createSqliteSessionRecordRepository(
  provideDatabase: SqlDatabaseProvider = defaultProvideDatabase,
): SessionRecordRepository {
  return new SqliteSessionRecordRepository(provideDatabase);
}
