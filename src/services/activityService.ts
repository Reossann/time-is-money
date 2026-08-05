/**
 * アクティビティ関連のユーティリティ関数を提供するサービス。
 */

/**
 * 秒数を "HH:MM:SS" 形式の文字列に変換
 * @param seconds - 秒数
 * @returns フォーマットされた時間文字列
 * @throws {Error} 入力値が無効な場合
 * @example
 * formatTime(0) => "00:00:00"
 * formatTime(61) => "00:01:01"
 * formatTime(3661) => "01:01:01"
 */
export function formatTime(seconds: number): string {
  // 入力値の検証
  if (typeof seconds !== "number") {
    throw new Error(
      `formatTime: 入力値は数値である必要があります。受け取った型: ${typeof seconds}`
    );
  }

  if (!Number.isFinite(seconds)) {
    throw new Error(
      `formatTime: 入力値は有限の数値である必要があります。受け取った値: ${seconds}`
    );
  }

  if (seconds < 0) {
    throw new Error(
      `formatTime: 入力値は 0 以上である必要があります。受け取った値: ${seconds}`
    );
  }

  const wholeSeconds = Math.floor(seconds);
  const hours = Math.floor(wholeSeconds / 3600);
  const minutes = Math.floor((wholeSeconds % 3600) / 60);
  const secs = wholeSeconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ].join(":");
}
