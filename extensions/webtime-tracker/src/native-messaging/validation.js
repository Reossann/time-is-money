import { sanitizeTrackedUrl } from "../tracking-utils.js";

export const NATIVE_MESSAGE_MAX_BYTES = 256 * 1024;
export const NATIVE_MESSAGE_TYPE = "URL_CHANGE";

export const nativeMessageErrorCode = Object.freeze({
  invalidJson: "INVALID_JSON",
  invalidMessageType: "INVALID_MESSAGE_TYPE",
  invalidUrl: "INVALID_URL",
  messageTooLarge: "MESSAGE_TOO_LARGE",
  internalError: "INTERNAL_ERROR",
});

function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidTimestamp(timestamp) {
  return typeof timestamp === "number" && Number.isFinite(timestamp) && Number.isInteger(timestamp);
}

/**
 * Host で扱う URL だけを受け付け、サニタイズ後の URL を返す。
 * @param {string} rawUrl
 * @returns {string | null}
 */
export function sanitizeNativeMessageUrl(rawUrl) {
  return sanitizeTrackedUrl(rawUrl);
}

/**
 * Native Messaging の URL_CHANGE メッセージを検証して正規化する。
 * @param {unknown} payload
 * @returns {{ok: true, value: {type: string, url: string, timestamp: number, sanitizedUrl: string}} | {ok: false, code: string, message: string}}
 */
export function validateNativeMessage(payload) {
  if (!isPlainObject(payload)) {
    return {
      ok: false,
      code: nativeMessageErrorCode.invalidJson,
      message: "Message must be a JSON object",
    };
  }

  const { type, url, timestamp } = payload;

  if (type !== NATIVE_MESSAGE_TYPE) {
    return {
      ok: false,
      code: nativeMessageErrorCode.invalidMessageType,
      message: `Unsupported message type: ${String(type)}`,
    };
  }

  if (typeof url !== "string") {
    return {
      ok: false,
      code: nativeMessageErrorCode.invalidUrl,
      message: "URL must be a string",
    };
  }

  if (!hasValidTimestamp(timestamp)) {
    return {
      ok: false,
      code: nativeMessageErrorCode.invalidJson,
      message: "timestamp must be an integer number",
    };
  }

  const sanitizedUrl = sanitizeNativeMessageUrl(url);

  if (!sanitizedUrl) {
    return {
      ok: false,
      code: nativeMessageErrorCode.invalidUrl,
      message: "Only HTTP/HTTPS URLs are allowed",
    };
  }

  return {
    ok: true,
    value: {
      type: NATIVE_MESSAGE_TYPE,
      url: sanitizedUrl,
      timestamp,
      sanitizedUrl,
    },
  };
}
