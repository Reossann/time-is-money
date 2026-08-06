import {
  DEFAULT_TONE,
  NOTIFICATION_MESSAGES,
  type NotificationTone,
} from "../constants/notificationMessages";

/**
 * 指定した口調のメッセージ一覧からランダムで1つ選んで返す
 * メッセージが空だった場合はフォールバックメッセージを返す
 */
export function pickRandomMessage(tone: NotificationTone = DEFAULT_TONE): string {
  const messages = NOTIFICATION_MESSAGES[tone];

  if (!messages || messages.length === 0) {
    console.error(`口調「${tone}」のメッセージが見つかりませんでした。デフォルトメッセージを使用します。`);
    return "Time Is Moneyを使っています";
  }

  const index = Math.floor(Math.random() * messages.length);
  return messages[index];
}
