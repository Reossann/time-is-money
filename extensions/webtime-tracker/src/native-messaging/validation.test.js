import { describe, expect, it } from "vitest";

import {
  NATIVE_MESSAGE_MAX_BYTES,
  NATIVE_MESSAGE_STOP_TYPE,
  NATIVE_MESSAGE_TYPE,
  nativeMessageErrorCode,
  sanitizeNativeMessageUrl,
  validateNativeMessage,
} from "./validation.js";

describe("NATIVE_MESSAGE_MAX_BYTES", () => {
  it("keeps the size limit at 256 KiB", () => {
    expect(NATIVE_MESSAGE_MAX_BYTES).toBe(256 * 1024);
  });
});

describe("sanitizeNativeMessageUrl", () => {
  it("sanitizes auth, query and hash", () => {
    expect(
      sanitizeNativeMessageUrl(
        "https://user:pass@docs.google.com/document/d/example?usp=sharing#heading",
      ),
    ).toBe("https://docs.google.com/document/d/example");
  });

  it.each([
    "chrome://extensions/",
    "file:///C:/secret.txt",
    "ftp://example.com/file",
    "not a url",
  ])("rejects non-HTTP(S) URLs: %s", (rawUrl) => {
    expect(sanitizeNativeMessageUrl(rawUrl)).toBeNull();
  });
});

describe("validateNativeMessage", () => {
  it("accepts a valid URL_CHANGE payload and returns a sanitized URL", () => {
    expect(
      validateNativeMessage({
        type: NATIVE_MESSAGE_TYPE,
        url: "https://docs.google.com/document/d/example?usp=sharing#heading",
        timestamp: 1_700_000_000_000,
      }),
    ).toEqual({
      ok: true,
      value: {
        type: NATIVE_MESSAGE_TYPE,
        url: "https://docs.google.com/document/d/example",
        sanitizedUrl: "https://docs.google.com/document/d/example",
        timestamp: 1_700_000_000_000,
      },
    });
  });

  it("accepts a TRACKING_STOP payload without a URL", () => {
    expect(
      validateNativeMessage({
        type: NATIVE_MESSAGE_STOP_TYPE,
        timestamp: 1_700_000_000_000,
      }),
    ).toEqual({
      ok: true,
      value: {
        type: NATIVE_MESSAGE_STOP_TYPE,
        timestamp: 1_700_000_000_000,
      },
    });
  });

  it.each([
    [{}, nativeMessageErrorCode.invalidMessageType],
    [null, nativeMessageErrorCode.invalidJson],
    [[], nativeMessageErrorCode.invalidJson],
    [
      { type: "UNKNOWN", url: "https://example.com", timestamp: 1 },
      nativeMessageErrorCode.invalidMessageType,
    ],
    [
      { type: NATIVE_MESSAGE_TYPE, url: "chrome://extensions/", timestamp: 1 },
      nativeMessageErrorCode.invalidUrl,
    ],
    [
      { type: NATIVE_MESSAGE_TYPE, url: "https://example.com", timestamp: 1.5 },
      nativeMessageErrorCode.invalidJson,
    ],
  ])("rejects invalid payloads", (payload, expectedCode) => {
    const result = validateNativeMessage(payload);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe(expectedCode);
    }
  });
});
