export const nativeConnectionState = Object.freeze({
  monitoring: "monitoring",
  connected: "connected",
  hostUnregistered: "host-unregistered",
  appUnavailable: "app-unavailable",
  sendFailed: "send-failed",
});

export class NativeMessagingClientError extends Error {
  constructor(code, message, detail) {
    super(detail ? `${detail}: ${message}` : message);
    this.name = "NativeMessagingClientError";
    this.code = code;
  }
}

function runtimeErrorCode(message) {
  return /native messaging host.*(?:not found|is not registered)|specified native messaging host|ネイティブ\s*メッセージング\s*ホスト.*(?:見つかりません|登録されていません|指定されていません)/i.test(
    message,
  )
    ? "HOST_UNREGISTERED"
    : "SEND_FAILED";
}

export function connectionStateForError(error) {
  if (!(error instanceof NativeMessagingClientError)) {
    return nativeConnectionState.sendFailed;
  }

  if (error.code === "HOST_UNREGISTERED") {
    return nativeConnectionState.hostUnregistered;
  }

  if (error.code === "APP_UNAVAILABLE") {
    return nativeConnectionState.appUnavailable;
  }

  return nativeConnectionState.sendFailed;
}

export function sendNativeMessage(runtime, hostName, message) {
  return new Promise((resolve, reject) => {
    runtime.sendNativeMessage(hostName, message, (response) => {
      const lastError = runtime.lastError;

      if (lastError) {
        const runtimeMessage = lastError.message ?? "Chrome did not provide an error message";

        reject(
          new NativeMessagingClientError(
            runtimeErrorCode(runtimeMessage),
            runtimeMessage,
            "Native Messaging Hostへ接続できませんでした",
          ),
        );
        return;
      }

      if (!response || typeof response !== "object") {
        reject(
          new NativeMessagingClientError(
            "INVALID_RESPONSE",
            "Native Messaging Hostから不正な応答を受信しました",
          ),
        );
        return;
      }

      if (response.success !== true) {
        reject(
          new NativeMessagingClientError(
            typeof response.code === "string" ? response.code : "SEND_FAILED",
            "Native Messaging Hostがメッセージを受理しませんでした",
          ),
        );
        return;
      }

      resolve(response);
    });
  });
}
