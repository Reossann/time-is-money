import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createInMemorySessionRecordRepository,
  SessionRecordRepositoryError,
  type SessionRecordRepository,
} from "../repositories/sessionRecordRepository";
import { useSessionRecordSaveStore } from "../stores/useSessionRecordSaveStore";
import { validSessionResult } from "../test/fixtures/sessionResult";
import type { FinalizedSessionResultState } from "./sessionFinalizationController";
import {
  configureSessionRecordPersistenceControllerForTests,
  getSavedSessionRecord,
  removeSavedSessionRecord,
  resetSessionRecordPersistenceControllerForTests,
  retrySaveFinalizedSessionRecord,
  saveFinalizedSessionRecordOnce,
  SessionRecordPersistenceError,
} from "./sessionRecordPersistenceController";

const FINALIZED: FinalizedSessionResultState = {
  status: "finalized",
  result: validSessionResult,
};

const NOW = 50_000;

function spyRepository(base: SessionRecordRepository = createInMemorySessionRecordRepository()) {
  const save = vi.fn(base.save.bind(base));
  const remove = vi.fn(base.remove.bind(base));
  return {
    repository: {
      save,
      remove,
      getBySessionId: base.getBySessionId.bind(base),
      listByDate: base.listByDate.bind(base),
      listByApp: base.listByApp.bind(base),
      listByOwner: base.listByOwner.bind(base),
      listByOwnerInRange: base.listByOwnerInRange.bind(base),
    } satisfies SessionRecordRepository,
    save,
    remove,
    base,
  };
}

describe("sessionRecordPersistenceController", () => {
  beforeEach(() => {
    resetSessionRecordPersistenceControllerForTests();
  });

  afterEach(() => {
    resetSessionRecordPersistenceControllerForTests();
  });

  it("saves the finalized result once and marks the store saved", async () => {
    const repo = spyRepository();
    configureSessionRecordPersistenceControllerForTests({
      getFinalizedSessionResult: () => FINALIZED,
      ownerIdentity: { getCurrentOwnerId: async () => "owner-1" },
      repository: repo.repository,
      now: () => NOW,
    });

    const saved = await saveFinalizedSessionRecordOnce();

    expect(saved.sessionId).toBe(validSessionResult.sessionId);
    expect(saved.ownerId).toBe("owner-1");
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(useSessionRecordSaveStore.getState().status).toBe("saved");
    expect(useSessionRecordSaveStore.getState().savedSessionId).toBe(
      validSessionResult.sessionId,
    );
    expect(getSavedSessionRecord()).toEqual(saved);
  });

  it("does not write again for the same session", async () => {
    const repo = spyRepository();
    configureSessionRecordPersistenceControllerForTests({
      getFinalizedSessionResult: () => FINALIZED,
      ownerIdentity: { getCurrentOwnerId: async () => "owner-1" },
      repository: repo.repository,
      now: () => NOW,
    });

    await saveFinalizedSessionRecordOnce();
    const second = await saveFinalizedSessionRecordOnce();

    expect(second.sessionId).toBe(validSessionResult.sessionId);
    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it("writes once under concurrent calls", async () => {
    const repo = spyRepository();
    configureSessionRecordPersistenceControllerForTests({
      getFinalizedSessionResult: () => FINALIZED,
      ownerIdentity: { getCurrentOwnerId: async () => "owner-1" },
      repository: repo.repository,
      now: () => NOW,
    });

    await Promise.all([
      saveFinalizedSessionRecordOnce(),
      saveFinalizedSessionRecordOnce(),
    ]);

    expect(repo.save).toHaveBeenCalledTimes(1);
  });

  it("rejects and marks failed when no finalized result exists", async () => {
    configureSessionRecordPersistenceControllerForTests({
      getFinalizedSessionResult: () => ({ status: "not-finalized" }),
      ownerIdentity: { getCurrentOwnerId: async () => "owner-1" },
    });

    await expect(saveFinalizedSessionRecordOnce()).rejects.toMatchObject({
      code: "NOT_FINALIZED",
    });
    expect(useSessionRecordSaveStore.getState().status).toBe("failed");
    expect(useSessionRecordSaveStore.getState().errorCode).toBe("NOT_FINALIZED");
  });

  it("marks OWNER_UNRESOLVED when the owner cannot be resolved", async () => {
    const repo = spyRepository();
    configureSessionRecordPersistenceControllerForTests({
      getFinalizedSessionResult: () => FINALIZED,
      ownerIdentity: {
        getCurrentOwnerId: async () => {
          throw new Error("no owner");
        },
      },
      repository: repo.repository,
      now: () => NOW,
    });

    await expect(saveFinalizedSessionRecordOnce()).rejects.toBeInstanceOf(
      SessionRecordPersistenceError,
    );
    expect(useSessionRecordSaveStore.getState().errorCode).toBe(
      "OWNER_UNRESOLVED",
    );
    expect(repo.save).not.toHaveBeenCalled();
  });

  it("keeps the result and retries after a save failure", async () => {
    const base = createInMemorySessionRecordRepository();
    let failNext = true;
    const repository: SessionRecordRepository = {
      ...base,
      save: vi.fn(async (record) => {
        if (failNext) {
          failNext = false;
          throw new SessionRecordRepositoryError("SAVE_FAILED", "disk error");
        }
        return base.save(record);
      }),
      getBySessionId: base.getBySessionId.bind(base),
      listByDate: base.listByDate.bind(base),
      listByApp: base.listByApp.bind(base),
      listByOwner: base.listByOwner.bind(base),
      remove: base.remove.bind(base),
    };
    configureSessionRecordPersistenceControllerForTests({
      getFinalizedSessionResult: () => FINALIZED,
      ownerIdentity: { getCurrentOwnerId: async () => "owner-1" },
      repository,
      now: () => NOW,
    });

    await expect(saveFinalizedSessionRecordOnce()).rejects.toMatchObject({
      code: "SAVE_FAILED",
    });
    expect(useSessionRecordSaveStore.getState().status).toBe("failed");

    const saved = await retrySaveFinalizedSessionRecord();
    expect(saved.sessionId).toBe(validSessionResult.sessionId);
    expect(useSessionRecordSaveStore.getState().status).toBe("saved");
  });

  it("removes the saved record and resets the store", async () => {
    const repo = spyRepository();
    configureSessionRecordPersistenceControllerForTests({
      getFinalizedSessionResult: () => FINALIZED,
      ownerIdentity: { getCurrentOwnerId: async () => "owner-1" },
      repository: repo.repository,
      now: () => NOW,
    });

    await saveFinalizedSessionRecordOnce();
    await removeSavedSessionRecord();

    expect(repo.remove).toHaveBeenCalledWith(
      validSessionResult.sessionId,
      "owner-1",
    );
    expect(
      await repo.base.getBySessionId(validSessionResult.sessionId),
    ).toBeNull();
    expect(useSessionRecordSaveStore.getState().status).toBe("idle");
    expect(getSavedSessionRecord()).toBeNull();
  });

  it("treats removing with nothing saved as a no-op", async () => {
    const repo = spyRepository();
    configureSessionRecordPersistenceControllerForTests({
      getFinalizedSessionResult: () => FINALIZED,
      ownerIdentity: { getCurrentOwnerId: async () => "owner-1" },
      repository: repo.repository,
    });

    await expect(removeSavedSessionRecord()).resolves.toBeUndefined();
    expect(repo.remove).not.toHaveBeenCalled();
  });
});
