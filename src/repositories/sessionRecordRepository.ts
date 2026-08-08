import type { SessionRecord } from "../types/sessionRecord";
import { sessionRecordSchema } from "../utils/sessionRecordSchemas";

export type SessionRecordRepositoryErrorCode =
  | "INVALID_RECORD"
  | "INVALID_STORED_RECORD"
  | "LOAD_FAILED"
  | "SAVE_FAILED"
  | "REMOVE_FAILED"
  | "OWNER_MISMATCH";

export class SessionRecordRepositoryError extends Error {
  constructor(
    public readonly code: SessionRecordRepositoryErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "SessionRecordRepositoryError";
  }
}

export interface SessionRecordRepository {
  /**
   * Upserts a record keyed by sessionId. Idempotent: saving the same session
   * again overwrites the existing row rather than inserting a duplicate. Returns
   * the canonical stored record.
   */
  save(record: SessionRecord): Promise<SessionRecord>;
  getBySessionId(sessionId: string): Promise<SessionRecord | null>;
  /** Owner-scoped lookup by local calendar day, "YYYY-MM-DD". */
  listByDate(
    ownerId: string,
    localDateKey: string,
  ): Promise<readonly SessionRecord[]>;
  /** Owner-scoped lookup for every session that used a given app. */
  listByApp(ownerId: string, appId: string): Promise<readonly SessionRecord[]>;
  listByOwner(ownerId: string): Promise<readonly SessionRecord[]>;
  /** Removes a record. The ownerId must match the stored owner. */
  remove(sessionId: string, ownerId: string): Promise<void>;
}

function createRepositoryError(
  code: SessionRecordRepositoryErrorCode,
): SessionRecordRepositoryError {
  const messages: Record<SessionRecordRepositoryErrorCode, string> = {
    INVALID_RECORD: "Session record is invalid",
    INVALID_STORED_RECORD: "Stored session record is invalid",
    LOAD_FAILED: "Session records could not be loaded",
    SAVE_FAILED: "Session record could not be saved",
    REMOVE_FAILED: "Session record could not be removed",
    OWNER_MISMATCH: "Session record belongs to a different owner",
  };
  return new SessionRecordRepositoryError(code, messages[code]);
}

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

/**
 * In-memory repository used by tests and as the reference implementation until
 * the SQLite-backed repository is wired (see #7). Every returned record is
 * validated and frozen so callers observe the same immutability guarantees as
 * the persistent implementation.
 */
export class InMemorySessionRecordRepository
  implements SessionRecordRepository
{
  private readonly records = new Map<string, SessionRecord>();

  private saveQueue: Promise<void> = Promise.resolve();

  save(record: SessionRecord): Promise<SessionRecord> {
    let canonical: SessionRecord;
    try {
      canonical = canonicalizeRecord(record);
    } catch {
      return Promise.reject(createRepositoryError("INVALID_RECORD"));
    }

    const operation = this.saveQueue.then(() => {
      const existing = this.records.get(canonical.sessionId);
      if (existing !== undefined && existing.ownerId !== canonical.ownerId) {
        throw createRepositoryError("OWNER_MISMATCH");
      }
      // Idempotent upsert: the sessionId key guarantees no duplicate row.
      this.records.set(canonical.sessionId, canonical);
      return canonical;
    });
    this.saveQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  getBySessionId(sessionId: string): Promise<SessionRecord | null> {
    return Promise.resolve(this.records.get(sessionId) ?? null);
  }

  listByDate(
    ownerId: string,
    localDateKey: string,
  ): Promise<readonly SessionRecord[]> {
    return Promise.resolve(
      this.sortedOwnerRecords(ownerId).filter(
        (record) => record.localDateKey === localDateKey,
      ),
    );
  }

  listByApp(
    ownerId: string,
    appId: string,
  ): Promise<readonly SessionRecord[]> {
    return Promise.resolve(
      this.sortedOwnerRecords(ownerId).filter((record) =>
        record.apps.some((app) => app.appId === appId),
      ),
    );
  }

  listByOwner(ownerId: string): Promise<readonly SessionRecord[]> {
    return Promise.resolve(this.sortedOwnerRecords(ownerId));
  }

  remove(sessionId: string, ownerId: string): Promise<void> {
    const operation = this.saveQueue.then(() => {
      const existing = this.records.get(sessionId);
      if (existing === undefined) return;
      if (existing.ownerId !== ownerId) {
        throw createRepositoryError("OWNER_MISMATCH");
      }
      this.records.delete(sessionId);
    });
    this.saveQueue = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }

  private sortedOwnerRecords(ownerId: string): SessionRecord[] {
    return [...this.records.values()]
      .filter((record) => record.ownerId === ownerId)
      .sort((left, right) => {
        if (left.endedAt !== right.endedAt) return right.endedAt - left.endedAt;
        return left.sessionId.localeCompare(right.sessionId);
      });
  }
}

export function createInMemorySessionRecordRepository(): SessionRecordRepository {
  return new InMemorySessionRecordRepository();
}
