import { describe, expect, it, vi } from "vitest";

import type { SettingsStore } from "../repositories/settingsStore";
import {
  createOwnerIdentityService,
  LOCAL_OWNER_ID_STORE_KEY,
  OwnerIdentityError,
} from "./ownerIdentityService";

function createFakeStore(initial?: Record<string, unknown>): {
  store: SettingsStore;
  get: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  save: ReturnType<typeof vi.fn>;
} {
  const data = new Map<string, unknown>(Object.entries(initial ?? {}));
  const get = vi.fn(async (key: string) => data.get(key));
  const set = vi.fn(async (key: string, value: unknown) => {
    data.set(key, value);
  });
  const save = vi.fn(async () => {});
  const reload = vi.fn(async () => {});
  return { store: { get, set, save, reload } as SettingsStore, get, set, save };
}

describe("ownerIdentityService", () => {
  it("generates and persists a local owner id when none is stored", async () => {
    const fake = createFakeStore();
    const service = createOwnerIdentityService(
      async () => fake.store,
      () => "generated-owner",
    );

    const ownerId = await service.getCurrentOwnerId();

    expect(ownerId).toBe("generated-owner");
    expect(fake.set).toHaveBeenCalledWith(
      LOCAL_OWNER_ID_STORE_KEY,
      "generated-owner",
    );
    expect(fake.save).toHaveBeenCalledTimes(1);
  });

  it("returns the stored owner id without regenerating", async () => {
    const fake = createFakeStore({ [LOCAL_OWNER_ID_STORE_KEY]: "stored-owner" });
    const generate = vi.fn(() => "generated-owner");
    const service = createOwnerIdentityService(async () => fake.store, generate);

    expect(await service.getCurrentOwnerId()).toBe("stored-owner");
    expect(generate).not.toHaveBeenCalled();
    expect(fake.set).not.toHaveBeenCalled();
  });

  it("caches the resolution across concurrent callers", async () => {
    const fake = createFakeStore();
    const generate = vi.fn(() => "generated-owner");
    const service = createOwnerIdentityService(async () => fake.store, generate);

    const [first, second] = await Promise.all([
      service.getCurrentOwnerId(),
      service.getCurrentOwnerId(),
    ]);

    expect(first).toBe("generated-owner");
    expect(second).toBe("generated-owner");
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it("regenerates when the stored value is blank", async () => {
    const fake = createFakeStore({ [LOCAL_OWNER_ID_STORE_KEY]: "   " });
    const service = createOwnerIdentityService(
      async () => fake.store,
      () => "generated-owner",
    );

    expect(await service.getCurrentOwnerId()).toBe("generated-owner");
    expect(fake.set).toHaveBeenCalledTimes(1);
  });

  it("throws on read failure and allows a later retry", async () => {
    const fake = createFakeStore({ [LOCAL_OWNER_ID_STORE_KEY]: "stored-owner" });
    let attempt = 0;
    const provideStore = vi.fn(async () => {
      attempt += 1;
      if (attempt === 1) throw new Error("store offline");
      return fake.store;
    });
    const service = createOwnerIdentityService(provideStore, () => "x");

    await expect(service.getCurrentOwnerId()).rejects.toBeInstanceOf(
      OwnerIdentityError,
    );
    expect(await service.getCurrentOwnerId()).toBe("stored-owner");
    expect(provideStore).toHaveBeenCalledTimes(2);
  });
});
