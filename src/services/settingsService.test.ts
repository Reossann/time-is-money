import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getSettingsStore: vi.fn(),
}));

vi.mock("../repositories/settingsStore", () => ({
  getSettingsStore: mocks.getSettingsStore,
}));

import { createDefaultSettings, loadSettings, saveSettings } from "./settingsService";

describe("settingsService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns default settings when no stored value exists", async () => {
    mocks.getSettingsStore.mockResolvedValue({
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    });

    await expect(loadSettings()).resolves.toEqual(createDefaultSettings());
  });

  it("returns the validated stored settings", async () => {
    const storedSettings = {
      hourlyRate: 4000,
      notificationThresholdMinutes: 15,
      idleThresholdMinutes: 10,
      notificationsEnabled: false,
      notificationTone: "gentle",
      notificationIntervalMinutes: 60,
    };

    mocks.getSettingsStore.mockResolvedValue({
      get: vi.fn().mockResolvedValue(storedSettings),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    });

    await expect(loadSettings()).resolves.toEqual(storedSettings);
  });

  it("normalizes legacy short intervals to 30 minutes", async () => {
    const store = {
      get: vi.fn().mockResolvedValue({
        ...createDefaultSettings(),
        notificationIntervalMinutes: 1,
      }),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };

    mocks.getSettingsStore.mockResolvedValue(store);

    await expect(loadSettings()).resolves.toEqual({
      ...createDefaultSettings(),
      notificationIntervalMinutes: 30,
    });
  });

  it("keeps the selected 15 minute interval when saving", async () => {
    const settings = {
      ...createDefaultSettings(),
      notificationIntervalMinutes: 15 as const,
    };
    const store = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };

    mocks.getSettingsStore.mockResolvedValue(store);

    await expect(saveSettings(settings)).resolves.toEqual(settings);
    expect(store.set).toHaveBeenCalledWith("app-settings", settings);
  });

  it("saves valid settings and returns them", async () => {
    const settings = createDefaultSettings();
    const store = {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      save: vi.fn().mockResolvedValue(undefined),
    };

    mocks.getSettingsStore.mockResolvedValue(store);

    await expect(saveSettings(settings)).resolves.toEqual(settings);
    expect(store.set).toHaveBeenCalledWith("app-settings", settings);
    expect(store.save).toHaveBeenCalledOnce();
  });
});
