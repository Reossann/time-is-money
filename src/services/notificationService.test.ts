import { describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_MESSAGES } from '../constants/notificationMessages';
import { pickRandomMessage } from './notificationService';

describe('notificationService', () => {
  it('spartan モード指定時にスパルタ用メッセージ一覧から選出されること', () => {
    const message = pickRandomMessage('spartan');
    expect(NOTIFICATION_MESSAGES.spartan).toContain(message);
  });

  it('gentle モード指定時にやさしいモード用メッセージ一覧から選出されること', () => {
    const message = pickRandomMessage('gentle');
    expect(NOTIFICATION_MESSAGES.gentle).toContain(message);
  });

  it('口調を未指定の場合、デフォルト口調 (spartan) から選出されること', () => {
    const message = pickRandomMessage();
    expect(NOTIFICATION_MESSAGES.spartan).toContain(message);
  });

  it('存在しない口調や空配列が渡されてメッセージが取得できない場合、エラーをコンソールに出力しフォールバック文字列を返すこと', () => {
    const spyError = vi.spyOn(console, 'error').mockImplementation(() => {});

    // @ts-expect-error テスト用に不正な口調を指定
    const message = pickRandomMessage('invalid_tone');

    // 情報を取得できなかった場合のエラーメッセージが出力されたか検証
    expect(spyError).toHaveBeenCalledWith(
      '口調「invalid_tone」のメッセージが見つかりませんでした。デフォルトメッセージを使用します。',
    );
    // フォールバック用のデフォルトメッセージが返されたか検証
    expect(message).toBe('Time Is Moneyを使っています');

    spyError.mockRestore();
  });
});
