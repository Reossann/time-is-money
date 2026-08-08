import { describe, expect, it, vi } from "vitest";

import {
  connectionStateForError,
  NativeMessagingClientError,
  nativeConnectionState,
  sendNativeMessage,
} from "./client.js";

function createRuntime({ response, lastError = null }) {
  return {
    lastError,
    sendNativeMessage: vi.fn((_host, _message, callback) => callback(response)),
  };
}

describe("sendNativeMessage", () => {
  it("resolves only successful host responses", async () => {
    const response = { success: true, code: "OK" };
    const runtime = createRuntime({ response });

    await expect(
      sendNativeMessage(runtime, "com.timeismoney.app", { type: "URL_CHANGE" }),
    ).resolves.toBe(response);
  });

  it("reports an unregistered host", async () => {
    const runtime = createRuntime({
      response: undefined,
      lastError: { message: "Specified native messaging host not found." },
    });

    await expect(
      sendNativeMessage(runtime, "com.timeismoney.app", { type: "URL_CHANGE" }),
    ).rejects.toMatchObject({ code: "HOST_UNREGISTERED" });
  });

  it("rejects APP_UNAVAILABLE responses", async () => {
    const runtime = createRuntime({
      response: { success: false, code: "APP_UNAVAILABLE" },
    });

    await expect(
      sendNativeMessage(runtime, "com.timeismoney.app", { type: "URL_CHANGE" }),
    ).rejects.toMatchObject({ code: "APP_UNAVAILABLE" });
  });
});

describe("connectionStateForError", () => {
  it("maps protocol errors to a visible connection state", () => {
    expect(
      connectionStateForError(
        new NativeMessagingClientError("APP_UNAVAILABLE", "unavailable"),
      ),
    ).toBe(nativeConnectionState.appUnavailable);
  });
});
