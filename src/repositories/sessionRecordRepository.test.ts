import { beforeEach, describe, expect, it } from "vitest";

import { buildSessionRecord } from "../services/sessionRecordService";
import { validSessionResult } from "../test/fixtures/sessionResult";
import type { SessionRecord } from "../types/sessionRecord";
import type { SessionResult } from "../types/sessionResult";
import { toLocalDateKey } from "../utils/localDate";
import {
  createInMemorySessionRecordRepository,
  SessionRecordRepositoryError,
  type SessionRecordRepository,
} from "./sessionRecordRepository";

const DAY_1 = new Date(2026, 0, 15, 10, 0, 0).getTime();
const DAY_2 = new Date(2026, 0, 16, 10, 0, 0).getTime();

function makeResult(sessionId: string, endedAt: number): SessionResult {
  // Keeps the fixture's app durations (tracked 8s, untracked 1s, total 9s).
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
): SessionRecord {
  return buildSessionRecord({
    result: makeResult(sessionId, endedAt),
    ownerId,
    now: endedAt,
  });
}

describe("InMemorySessionRecordRepository", () => {
  let repository: SessionRecordRepository;

  beforeEach(() => {
    repository = createInMemorySessionRecordRepository();
  });

  it("saves and reads a record by session id", async () => {
    const record = makeRecord("s1", "owner-1", DAY_1);
    const saved = await repository.save(record);

    expect(saved.sessionId).toBe("s1");
    expect(await repository.getBySessionId("s1")).toEqual(record);
  });

  it("returns null for an unknown session id", async () => {
    expect(await repository.getBySessionId("missing")).toBeNull();
  });

  it("is idempotent: saving the same session again does not duplicate", async () => {
    const record = makeRecord("s1", "owner-1", DAY_1);
    await repository.save(record);
    await repository.save(record);

    const all = await repository.listByOwner("owner-1");
    expect(all).toHaveLength(1);
  });

  it("overwrites the stored record on re-save of the same session", async () => {
    await repository.save(makeRecord("s1", "owner-1", DAY_1));
    const updated = buildSessionRecord({
      result: makeResult("s1", DAY_1),
      ownerId: "owner-1",
      now: DAY_1,
      syncStatus: "pending-sync",
    });
    await repository.save(updated);

    const stored = await repository.getBySessionId("s1");
    expect(stored?.syncStatus).toBe("pending-sync");
  });

  it("keeps records isolated per owner", async () => {
    await repository.save(makeRecord("s1", "owner-1", DAY_1));
    await repository.save(makeRecord("s2", "owner-2", DAY_1));

    const ownerOne = await repository.listByOwner("owner-1");
    expect(ownerOne.map((record) => record.sessionId)).toEqual(["s1"]);
  });

  it("rejects re-saving a session under a different owner", async () => {
    await repository.save(makeRecord("s1", "owner-1", DAY_1));

    await expect(
      repository.save(makeRecord("s1", "owner-2", DAY_1)),
    ).rejects.toBeInstanceOf(SessionRecordRepositoryError);
    // The original owner's record is untouched.
    const stored = await repository.getBySessionId("s1");
    expect(stored?.ownerId).toBe("owner-1");
  });

  it("lists records for an owner on a given local day", async () => {
    await repository.save(makeRecord("s1", "owner-1", DAY_1));
    await repository.save(makeRecord("s2", "owner-1", DAY_2));
    await repository.save(makeRecord("s3", "owner-2", DAY_1));

    const dayOne = await repository.listByDate(
      "owner-1",
      toLocalDateKey(DAY_1),
    );
    expect(dayOne.map((record) => record.sessionId)).toEqual(["s1"]);
  });

  it("lists records for an owner that used a given app", async () => {
    await repository.save(makeRecord("s1", "owner-1", DAY_1));
    await repository.save(makeRecord("s2", "owner-2", DAY_1));

    const withCode = await repository.listByApp("owner-1", "code.exe");
    expect(withCode.map((record) => record.sessionId)).toEqual(["s1"]);

    const withUnknown = await repository.listByApp("owner-1", "notepad.exe");
    expect(withUnknown).toEqual([]);
  });

  it("sorts owner records by endedAt descending", async () => {
    await repository.save(makeRecord("s1", "owner-1", DAY_1));
    await repository.save(makeRecord("s2", "owner-1", DAY_2));

    const all = await repository.listByOwner("owner-1");
    expect(all.map((record) => record.sessionId)).toEqual(["s2", "s1"]);
  });

  it("removes a record for the matching owner", async () => {
    await repository.save(makeRecord("s1", "owner-1", DAY_1));
    await repository.remove("s1", "owner-1");

    expect(await repository.getBySessionId("s1")).toBeNull();
  });

  it("treats removing a missing record as a no-op", async () => {
    await expect(repository.remove("missing", "owner-1")).resolves.toBeUndefined();
  });

  it("rejects removing a record owned by someone else", async () => {
    await repository.save(makeRecord("s1", "owner-1", DAY_1));

    await expect(repository.remove("s1", "owner-2")).rejects.toBeInstanceOf(
      SessionRecordRepositoryError,
    );
    expect(await repository.getBySessionId("s1")).not.toBeNull();
  });

  it("rejects an invalid record on save", async () => {
    const invalid = { ...makeRecord("s1", "owner-1", DAY_1), ownerId: "" };

    await expect(
      repository.save(invalid as unknown as SessionRecord),
    ).rejects.toBeInstanceOf(SessionRecordRepositoryError);
  });

  it("returns frozen records", async () => {
    const saved = await repository.save(makeRecord("s1", "owner-1", DAY_1));
    expect(Object.isFrozen(saved)).toBe(true);
    expect(Object.isFrozen(saved.apps)).toBe(true);
  });
});
