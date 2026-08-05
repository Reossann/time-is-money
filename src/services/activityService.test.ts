import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ActiveWindowInfo } from "../types/activity";
import { getActiveWindowInfo } from "./activityService";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

const validActiveWindowInfo = {
  processName: "Code.exe",
  windowTitle: "time-is-money",
  processId: 4_242,
} as const satisfies ActiveWindowInfo;

describe("getActiveWindowInfo", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("invokes the registered Command and returns a valid payload", async () => {
    invokeMock.mockResolvedValue(validActiveWindowInfo);

    await expect(getActiveWindowInfo()).resolves.toEqual(validActiveWindowInfo);
    expect(invokeMock).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith("get_active_window_info");
  });

  it("returns null when there is no foreground window", async () => {
    invokeMock.mockResolvedValue(null);

    await expect(getActiveWindowInfo()).resolves.toBeNull();
  });

  it("rejects a snake_case payload", async () => {
    invokeMock.mockResolvedValue({
      process_name: "Code.exe",
      window_title: "time-is-money",
      process_id: 4_242,
    });

    await expect(getActiveWindowInfo()).rejects.toThrow();
  });

  it("rejects a payload with an invalid field type", async () => {
    invokeMock.mockResolvedValue({
      ...validActiveWindowInfo,
      processId: "4242",
    });

    await expect(getActiveWindowInfo()).rejects.toThrow();
  });

  it("preserves an invoke failure", async () => {
    const invokeError = new Error("Command invocation failed");
    invokeMock.mockRejectedValue(invokeError);

    await expect(getActiveWindowInfo()).rejects.toBe(invokeError);
  });
});
