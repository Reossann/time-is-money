/**
 * アクティビティ関連のユーティリティ関数を提供するサービス。
 */

/**
 * 秒数を "HH:MM:SS" 形式の文字列に変換
 * @param seconds - 秒数
 * @returns フォーマットされた時間文字列
 * @example
 * formatTime(0) => "00:00:00"
 * formatTime(61) => "00:01:01"
 * formatTime(3661) => "01:01:01"
 */
export function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return [
    String(hours).padStart(2, "0"),
    String(minutes).padStart(2, "0"),
    String(secs).padStart(2, "0"),
  ].join(":");
}
