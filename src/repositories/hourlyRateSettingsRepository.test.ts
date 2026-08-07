import { describe, expect, it } from "vitest";

import type { HourlyRateSettings } from "../types/hourlyRateSettings";
import {
  createDefaultHourlyRateSettings,
  registerDesktopApp,
  setAppHourlyRateYen,
  setDefaultHourlyRateYen,
} from "../services/hourlyRateSettingsService";
import {
  createHourlyRateSettingsRepository,
  HOURLY_RATE_SETTINGS_STORE_KEY,
  HourlyRateSettingsRepositoryError,
} from "./hourlyRateSettingsRepository";
import type { SettingsStore } from "./settingsStore";

type Deferred = Readonly<{
  promise: Promise<void>;
  resolve: () => void;
}>;

function createDeferred(): Deferred {
  let resolvePromise: (() => void) | undefined;
  const promise = new Promise<void>((resolve) => {
    resolvePromise = resolve;
  });

  return {
    promise,
    resolve: () => resolvePromise?.(),
  };
}

function cloneMap(source: ReadonlyMap<string, unknown>): Map<string, unknown> {
  return new Map(
    Array.from(source, ([key, value]) => [key, structuredClone(value)]),
  );
}

class FakeSettingsStore implements SettingsStore {
  readonly getCalls: string[] = [];
  readonly setCalls: Array<Readonly<{ key: string; value: unknown }>> = [];
  readonly reloadCalls: Array<Readonly<{ ignoreDefaults?: boolean }>> = [];
  saveCalls = 0;
  failGet = false;
  failSet = false;
  failSave = false;
  failReload = false;
  onSave: ((callNumber: number) => Promise<void>) | undefined;

  private memory: Map<string, unknown>;
  private disk: Map<string, unknown>;

  constructor(initialDisk: ReadonlyMap<string, unknown> = new Map()) {
    this.disk = cloneMap(initialDisk);
    this.memory = cloneMap(initialDisk);
  }

  async get<T>(key: string): Promise<T | undefined> {
    this.getCalls.push(key);
    if (this.failGet) {
      throw new Error("fake get failure");
    }
    const value = this.memory.get(key);
    return value === undefined ? undefined : structuredClone(value as T);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.setCalls.push({ key, value: structuredClone(value) });
    if (this.failSet) {
      throw new Error("fake set failure");
    }
    this.memory.set(key, structuredClone(value));
  }

  async reload(options: { ignoreDefaults?: boolean } = {}): Promise<void> {
    this.reloadCalls.push(options);
    if (this.failReload) {
      throw new Error("fake reload failure");
    }
    this.memory = cloneMap(this.disk);
  }

  async save(): Promise<void> {
    this.saveCalls += 1;
    await this.onSave?.(this.saveCalls);
    if (this.failSave) {
      throw new Error("fake save failure");
    }
    this.disk = cloneMap(this.memory);
  }

  getDiskValue<T>(key: string): T | undefined {
    const value = this.disk.get(key);
    return value === undefined ? undefined : structuredClone(value as T);
  }

  getMemoryValue<T>(key: string): T | undefined {
    const value = this.memory.get(key);
    return value === undefined ? undefined : structuredClone(value as T);
  }
}

function createValidSettings(): HourlyRateSettings {
  const defaults = setDefaultHourlyRateYen(
    3_000,
    createDefaultHourlyRateSettings(),
  );
  const withNotepad = registerDesktopApp("notepad.exe", defaults);
  const withCode = registerDesktopApp("Code.exe", withNotepad);
  return setAppHourlyRateYen("Code.exe", 1_500, withCode);
}

function createRepository(store: SettingsStore) {
  return createHourlyRateSettingsRepository(async () => store);
}

describe("hourlyRateSettingsRepository.load", () => {
  it("returns immutable defaults without writing when the key is missing", async () => {
    const store = new FakeSettingsStore(
      new Map([["notification-settings-v1", { tone: "spartan" }]]),
    );
    const repository = createRepository(store);

    const settings = await repository.load();

    expect(settings).toEqual({
      schemaVersion: 1,
      defaultHourlyRateYen: 0,
      desktopApps: [],
    });
    expect(store.getCalls).toEqual([HOURLY_RATE_SETTINGS_STORE_KEY]);
    expect(store.setCalls).toEqual([]);
    expect(store.saveCalls).toBe(0);
    expect(Object.isFrozen(settings)).toBe(true);
    expect(Object.isFrozen(settings.desktopApps)).toBe(true);
  });

  it("loads, sorts, and freezes valid stored settings", async () => {
    const storedSettings = createValidSettings();
    expect(storedSettings.desktopApps.map((entry) => entry.appId)).toEqual([
      "notepad.exe",
      "code.exe",
    ]);
    const store = new FakeSettingsStore(
      new Map([[HOURLY_RATE_SETTINGS_STORE_KEY, storedSettings]]),
    );

    const settings = await createRepository(store).load();

    expect(settings.desktopApps.map((entry) => entry.appId)).toEqual([
      "code.exe",
      "notepad.exe",
    ]);
    expect(Object.isFrozen(settings)).toBe(true);
    expect(Object.isFrozen(settings.desktopApps)).toBe(true);
    expect(settings.desktopApps.every(Object.isFrozen)).toBe(true);
  });

  it.each([
    ["unknown version", { ...createValidSettings(), schemaVersion: 2 }],
    [
      "missing field",
      { schemaVersion: 1, defaultHourlyRateYen: 3_000 },
    ],
    [
      "duplicate app",
      {
        ...createValidSettings(),
        desktopApps: [
          {
            appId: "code.exe",
            processName: "Code.exe",
            hourlyRateYen: null,
          },
          {
            appId: "code.exe",
            processName: "CODE.EXE",
            hourlyRateYen: 0,
          },
        ],
      },
    ],
    [
      "invalid rate",
      { ...createValidSettings(), defaultHourlyRateYen: -1 },
    ],
  ])("rejects %s stored settings", async (_label, storedValue) => {
    const store = new FakeSettingsStore(
      new Map([[HOURLY_RATE_SETTINGS_STORE_KEY, storedValue]]),
    );

    await expect(createRepository(store).load()).rejects.toMatchObject({
      code: "INVALID_STORED_SETTINGS",
    });
  });

  it("does not expose invalid stored values in repository errors", async () => {
    const privateProcessName = "private-client-contract.docx - Code.exe";
    const store = new FakeSettingsStore(
      new Map([
        [
          HOURLY_RATE_SETTINGS_STORE_KEY,
          {
            schemaVersion: 1,
            defaultHourlyRateYen: 3_000,
            desktopApps: [
              {
                appId: "wrong.exe",
                processName: privateProcessName,
                hourlyRateYen: null,
              },
            ],
          },
        ],
      ]),
    );

    try {
      await createRepository(store).load();
      throw new Error("expected load to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HourlyRateSettingsRepositoryError);
      expect(error).toMatchObject({ code: "INVALID_STORED_SETTINGS" });
      expect((error as Error).message).not.toContain(privateProcessName);
    }
  });

  it("maps store access failures to a typed load error", async () => {
    const store = new FakeSettingsStore();
    store.failGet = true;

    await expect(createRepository(store).load()).rejects.toMatchObject({
      code: "LOAD_FAILED",
    });
  });
});

describe("hourlyRateSettingsRepository.save", () => {
  it("validates, canonicalizes, and explicitly saves the dedicated key", async () => {
    const otherSettings = { tone: "spartan" };
    const store = new FakeSettingsStore(
      new Map([["notification-settings-v1", otherSettings]]),
    );
    const repository = createRepository(store);

    const savedSettings = await repository.save(createValidSettings());

    expect(store.setCalls).toHaveLength(1);
    expect(store.setCalls[0].key).toBe(HOURLY_RATE_SETTINGS_STORE_KEY);
    expect(store.saveCalls).toBe(1);
    expect(savedSettings.desktopApps.map((entry) => entry.appId)).toEqual([
      "code.exe",
      "notepad.exe",
    ]);
    expect(store.getDiskValue(HOURLY_RATE_SETTINGS_STORE_KEY)).toEqual(
      savedSettings,
    );
    expect(store.getDiskValue("notification-settings-v1")).toEqual(
      otherSettings,
    );
    expect(Object.isFrozen(savedSettings)).toBe(true);
    expect(Object.isFrozen(savedSettings.desktopApps)).toBe(true);
    expect(savedSettings.desktopApps.every(Object.isFrozen)).toBe(true);
  });

  it("does not resolve before the explicit store save completes", async () => {
    const saveStarted = createDeferred();
    const releaseSave = createDeferred();
    const store = new FakeSettingsStore();
    store.onSave = async () => {
      saveStarted.resolve();
      await releaseSave.promise;
    };
    const repository = createRepository(store);
    let resolved = false;

    const savePromise = repository.save(createValidSettings()).then((settings) => {
      resolved = true;
      return settings;
    });
    await saveStarted.promise;
    await Promise.resolve();

    expect(resolved).toBe(false);

    releaseSave.resolve();
    const savedSettings = await savePromise;
    expect(savedSettings).toEqual(
      store.getDiskValue(HOURLY_RATE_SETTINGS_STORE_KEY),
    );
  });

  it("rejects invalid input without touching the store", async () => {
    const privateProcessName = "private-client-contract.docx - Code.exe";
    const invalidSettings = {
      schemaVersion: 1,
      defaultHourlyRateYen: 3_000,
      desktopApps: [
        {
          appId: "wrong.exe",
          processName: privateProcessName,
          hourlyRateYen: null,
        },
      ],
    } as HourlyRateSettings;
    const store = new FakeSettingsStore();

    try {
      await createRepository(store).save(invalidSettings);
      throw new Error("expected save to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(HourlyRateSettingsRepositoryError);
      expect(error).toMatchObject({ code: "INVALID_SETTINGS" });
      expect((error as Error).message).not.toContain(privateProcessName);
    }
    expect(store.setCalls).toEqual([]);
    expect(store.saveCalls).toBe(0);
  });

  it("reloads disk state after save failure and permits a safe retry", async () => {
    const storedSettings = setDefaultHourlyRateYen(
      1_000,
      createDefaultHourlyRateSettings(),
    );
    const store = new FakeSettingsStore(
      new Map([[HOURLY_RATE_SETTINGS_STORE_KEY, storedSettings]]),
    );
    store.failSave = true;
    const repository = createRepository(store);

    await expect(
      repository.save(
        setDefaultHourlyRateYen(2_000, createDefaultHourlyRateSettings()),
      ),
    ).rejects.toMatchObject({ code: "SAVE_FAILED" });

    expect(store.reloadCalls).toEqual([{ ignoreDefaults: true }]);
    expect(store.getMemoryValue(HOURLY_RATE_SETTINGS_STORE_KEY)).toEqual(
      storedSettings,
    );
    await expect(repository.load()).resolves.toEqual(storedSettings);

    store.failSave = false;
    const retrySettings = setDefaultHourlyRateYen(
      3_000,
      createDefaultHourlyRateSettings(),
    );
    await expect(repository.save(retrySettings)).resolves.toEqual(retrySettings);
    expect(store.getDiskValue(HOURLY_RATE_SETTINGS_STORE_KEY)).toEqual(
      retrySettings,
    );
  });

  it("blocks access to tainted memory until disk recovery succeeds", async () => {
    const storedSettings = setDefaultHourlyRateYen(
      1_000,
      createDefaultHourlyRateSettings(),
    );
    const store = new FakeSettingsStore(
      new Map([[HOURLY_RATE_SETTINGS_STORE_KEY, storedSettings]]),
    );
    store.failSave = true;
    store.failReload = true;
    const repository = createRepository(store);

    await expect(
      repository.save(
        setDefaultHourlyRateYen(2_000, createDefaultHourlyRateSettings()),
      ),
    ).rejects.toMatchObject({ code: "RECOVERY_FAILED" });
    await expect(repository.load()).rejects.toMatchObject({
      code: "RECOVERY_FAILED",
    });

    store.failReload = false;
    await expect(repository.load()).resolves.toEqual(storedSettings);
  });

  it("serializes concurrent saves so the newest request wins", async () => {
    const firstSaveStarted = createDeferred();
    const releaseFirstSave = createDeferred();
    const store = new FakeSettingsStore();
    store.onSave = async (callNumber) => {
      if (callNumber === 1) {
        firstSaveStarted.resolve();
        await releaseFirstSave.promise;
      }
    };
    const repository = createRepository(store);
    const olderSettings = setDefaultHourlyRateYen(
      1_000,
      createDefaultHourlyRateSettings(),
    );
    const newerSettings = setDefaultHourlyRateYen(
      2_000,
      createDefaultHourlyRateSettings(),
    );

    const olderSave = repository.save(olderSettings);
    await firstSaveStarted.promise;
    const newerSave = repository.save(newerSettings);
    await Promise.resolve();

    expect(store.setCalls).toHaveLength(1);

    releaseFirstSave.resolve();
    await expect(olderSave).resolves.toEqual(olderSettings);
    await expect(newerSave).resolves.toEqual(newerSettings);

    expect(store.setCalls).toHaveLength(2);
    expect(store.saveCalls).toBe(2);
    expect(store.getDiskValue(HOURLY_RATE_SETTINGS_STORE_KEY)).toEqual(
      newerSettings,
    );
  });
});
