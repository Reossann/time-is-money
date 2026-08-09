import { beforeEach, describe, expect, it } from "vitest";

import { buildSessionRecord } from "../services/sessionRecordService";
import { validSessionResult } from "../test/fixtures/sessionResult";
import type { SessionRecord } from "../types/sessionRecord";
import type { SessionResult } from "../types/sessionResult";
import { toLocalDateKey } from "../utils/localDate";
import { SessionRecordRepositoryError } from "./sessionRecordRepository";
import type {
  SessionRecordAppRow,
  SessionRecordParentRow,
} from "./sessionRecordRowMapper";
import {
  createSqliteSessionRecordRepository,
  SESSION_RECORD_SQL,
  type SqlDatabase,
} from "./sqliteSessionRecordRepository";

const END = new Date(2026, 0, 15, 10, 0, 0).getTime();
const END_NEXT_DAY = new Date(2026, 0, 16, 10, 0, 0).getTime();

function makeResult(sessionId: string, endedAt: number): SessionResult {
  return {
    ...validSessionResult,
    sessionId,
    startedAt: endedAt - 9_000,
    endedAt,
  };
}

function makeRecord(
  sessionId: string,
  ownerId: string,
  endedAt: number,
  now = endedAt,
): SessionRecord {
  return buildSessionRecord({
    result: makeResult(sessionId, endedAt),
    ownerId,
    now,
  });
}

function parentFromBinds(binds: unknown[]): SessionRecordParentRow {
  return {
    session_id: binds[0] as string,
    schema_version: binds[1] as number,
    owner_id: binds[2] as string,
    started_at: binds[3] as number,
    ended_at: binds[4] as number,
    duration_seconds: binds[5] as number,
    tracked_duration_seconds: binds[6] as number,
    untracked_duration_seconds: binds[7] as number,
    earned_yen: binds[8] as number,
    wasted_yen: binds[9] as number,
    net_yen: binds[10] as number,
    local_date_key: binds[11] as string,
    created_at: binds[12] as number,
    updated_at: binds[13] as number,
    sync_status: binds[14] as string,
  };
}

function appFromBinds(binds: unknown[]): SessionRecordAppRow {
  return {
    session_id: binds[0] as string,
    app_id: binds[1] as string,
    process_name: binds[2] as string,
    duration_seconds: binds[3] as number,
    category: binds[4] as string | null,
    hourly_rate_yen: binds[5] as number,
    earned_yen: binds[6] as number,
    wasted_yen: binds[7] as number,
    net_yen: binds[8] as number,
  };
}

class FakeSqlDatabase implements SqlDatabase {
  readonly parents = new Map<string, SessionRecordParentRow>();
  readonly apps = new Map<string, SessionRecordAppRow[]>();
  failNextExecute = false;
  failNextSelect = false;

  execute(query: string, bindValues: unknown[] = []): Promise<unknown> {
    if (this.failNextExecute) {
      this.failNextExecute = false;
      return Promise.reject(new Error("db execute failed"));
    }
    switch (query) {
      case SESSION_RECORD_SQL.upsertParent: {
        const row = parentFromBinds(bindValues);
        const existing = this.parents.get(row.session_id);
        this.parents.set(
          row.session_id,
          existing ? { ...row, created_at: existing.created_at } : row,
        );
        return Promise.resolve({ rowsAffected: 1 });
      }
      case SESSION_RECORD_SQL.deleteApps:
        this.apps.delete(String(bindValues[0]));
        return Promise.resolve({ rowsAffected: 1 });
      case SESSION_RECORD_SQL.insertApp: {
        const row = appFromBinds(bindValues);
        const list = this.apps.get(row.session_id) ?? [];
        list.push(row);
        this.apps.set(row.session_id, list);
        return Promise.resolve({ rowsAffected: 1 });
      }
      case SESSION_RECORD_SQL.deleteParent:
        this.parents.delete(String(bindValues[0]));
        this.apps.delete(String(bindValues[0]));
        return Promise.resolve({ rowsAffected: 1 });
      default:
        return Promise.reject(new Error(`unexpected execute: ${query}`));
    }
  }

  select<T>(query: string, bindValues: unknown[] = []): Promise<T> {
    if (this.failNextSelect) {
      this.failNextSelect = false;
      return Promise.reject(new Error("db select failed"));
    }
    switch (query) {
      case SESSION_RECORD_SQL.selectOwner: {
        const parent = this.parents.get(String(bindValues[0]));
        return Promise.resolve(
          (parent ? [{ owner_id: parent.owner_id }] : []) as T,
        );
      }
      case SESSION_RECORD_SQL.selectParentById: {
        const parent = this.parents.get(String(bindValues[0]));
        return Promise.resolve((parent ? [parent] : []) as T);
      }
      case SESSION_RECORD_SQL.selectAppsById: {
        const list = [...(this.apps.get(String(bindValues[0])) ?? [])];
        list.sort(
          (left, right) =>
            right.duration_seconds - left.duration_seconds ||
            left.app_id.localeCompare(right.app_id),
        );
        return Promise.resolve(list as T);
      }
      case SESSION_RECORD_SQL.selectByOwner:
        return Promise.resolve(
          this.sortedParents((parent) => parent.owner_id === bindValues[0]) as T,
        );
      case SESSION_RECORD_SQL.selectByOwnerInRange:
        return Promise.resolve(
          this.sortedParents(
            (parent) =>
              parent.owner_id === bindValues[0] &&
              parent.ended_at >= Number(bindValues[1]) &&
              parent.ended_at < Number(bindValues[2]),
          ).slice(0, Number(bindValues[3])) as T,
        );
      case SESSION_RECORD_SQL.selectByDate:
        return Promise.resolve(
          this.sortedParents(
            (parent) =>
              parent.owner_id === bindValues[0] &&
              parent.local_date_key === bindValues[1],
          ) as T,
        );
      case SESSION_RECORD_SQL.selectByApp:
        return Promise.resolve(
          this.sortedParents(
            (parent) =>
              parent.owner_id === bindValues[0] &&
              (this.apps.get(parent.session_id) ?? []).some(
                (app) => app.app_id === bindValues[1],
              ),
          ) as T,
        );
      default:
        return Promise.reject(new Error(`unexpected select: ${query}`));
    }
  }

  private sortedParents(
    predicate: (parent: SessionRecordParentRow) => boolean,
  ): SessionRecordParentRow[] {
    return [...this.parents.values()]
      .filter(predicate)
      .sort(
        (left, right) =>
          right.ended_at - left.ended_at ||
          left.session_id.localeCompare(right.session_id),
      );
  }
}

describe("SqliteSessionRecordRepository", () => {
  let db: FakeSqlDatabase;
  let repository: ReturnType<typeof createSqliteSessionRecordRepository>;

  beforeEach(() => {
    db = new FakeSqlDatabase();
    repository = createSqliteSessionRecordRepository(async () => db);
  });

  it("saves and reads back an equivalent record", async () => {
    const record = makeRecord("s1", "owner-1", END);
    await repository.save(record);

    expect(await repository.getBySessionId("s1")).toEqual(record);
  });

  it("returns null for an unknown session id", async () => {
    expect(await repository.getBySessionId("missing")).toBeNull();
  });

  it("is idempotent and replaces child rows on re-save", async () => {
    const record = makeRecord("s1", "owner-1", END);
    await repository.save(record);
    await repository.save(record);

    expect(db.parents.size).toBe(1);
    expect(db.apps.get("s1")).toHaveLength(record.apps.length);
  });

  it("preserves created_at but updates updated_at on re-save", async () => {
    await repository.save(makeRecord("s1", "owner-1", END, 30_000));
    await repository.save(makeRecord("s1", "owner-1", END, 40_000));

    const stored = await repository.getBySessionId("s1");
    expect(stored?.createdAt).toBe(30_000);
    expect(stored?.updatedAt).toBe(40_000);
  });

  it("rejects re-saving a session under a different owner", async () => {
    await repository.save(makeRecord("s1", "owner-1", END));

    await expect(
      repository.save(makeRecord("s1", "owner-2", END)),
    ).rejects.toBeInstanceOf(SessionRecordRepositoryError);
    expect((await repository.getBySessionId("s1"))?.ownerId).toBe("owner-1");
  });

  it("lists an owner's records for a local day", async () => {
    await repository.save(makeRecord("s1", "owner-1", END));
    await repository.save(makeRecord("s2", "owner-1", END_NEXT_DAY));
    await repository.save(makeRecord("s3", "owner-2", END));

    const dayOne = await repository.listByDate("owner-1", toLocalDateKey(END));
    expect(dayOne.map((record) => record.sessionId)).toEqual(["s1"]);
  });

  it("lists an owner's records that used an app", async () => {
    await repository.save(makeRecord("s1", "owner-1", END));
    await repository.save(makeRecord("s2", "owner-2", END));

    const withCode = await repository.listByApp("owner-1", "code.exe");
    expect(withCode.map((record) => record.sessionId)).toEqual(["s1"]);
    expect(await repository.listByApp("owner-1", "notepad.exe")).toEqual([]);
  });

  it("lists an owner's records sorted by endedAt descending", async () => {
    await repository.save(makeRecord("s1", "owner-1", END));
    await repository.save(makeRecord("s2", "owner-1", END_NEXT_DAY));

    const all = await repository.listByOwner("owner-1");
    expect(all.map((record) => record.sessionId)).toEqual(["s2", "s1"]);
  });

  it("lists an owner-scoped end-boundary range with a limit", async () => {
    await repository.save(makeRecord("s1", "owner-1", END));
    await repository.save(makeRecord("s2", "owner-1", END_NEXT_DAY));
    await repository.save(makeRecord("s3", "owner-2", END_NEXT_DAY));

    const records = await repository.listByOwnerInRange(
      "owner-1",
      END,
      END_NEXT_DAY + 1,
      1,
    );
    expect(records.map((record) => record.sessionId)).toEqual(["s2"]);
  });

  it("removes a record for the matching owner", async () => {
    await repository.save(makeRecord("s1", "owner-1", END));
    await repository.remove("s1", "owner-1");

    expect(await repository.getBySessionId("s1")).toBeNull();
    expect(db.apps.has("s1")).toBe(false);
  });

  it("rejects removing a record owned by someone else", async () => {
    await repository.save(makeRecord("s1", "owner-1", END));

    await expect(repository.remove("s1", "owner-2")).rejects.toBeInstanceOf(
      SessionRecordRepositoryError,
    );
    expect(await repository.getBySessionId("s1")).not.toBeNull();
  });

  it("maps a database read failure to LOAD_FAILED", async () => {
    db.failNextSelect = true;
    await expect(repository.getBySessionId("s1")).rejects.toMatchObject({
      code: "LOAD_FAILED",
    });
  });

  it("maps a database write failure to SAVE_FAILED", async () => {
    db.failNextExecute = true;
    await expect(
      repository.save(makeRecord("s1", "owner-1", END)),
    ).rejects.toMatchObject({ code: "SAVE_FAILED" });
  });

  it("maps an invalid stored record to INVALID_STORED_RECORD", async () => {
    const record = makeRecord("s1", "owner-1", END);
    await repository.save(record);
    // Corrupt the stored parent row so validation fails on read.
    const parent = db.parents.get("s1");
    if (parent !== undefined) {
      db.parents.set("s1", { ...parent, local_date_key: "1999-12-31" });
    }

    await expect(repository.getBySessionId("s1")).rejects.toMatchObject({
      code: "INVALID_STORED_RECORD",
    });
  });

  it("rejects an invalid record before touching the database", async () => {
    const invalid = { ...makeRecord("s1", "owner-1", END), ownerId: "" };
    await expect(
      repository.save(invalid as unknown as SessionRecord),
    ).rejects.toMatchObject({ code: "INVALID_RECORD" });
    expect(db.parents.size).toBe(0);
  });
});
