import { useEffect, useState } from 'react';
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification';

type NotificationFeedback = {
  type: 'success' | 'error';
  message: string;
};

export function SettingsPage() {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [autostartErrorMessage, setAutostartErrorMessage] = useState<
    string | null
  >(null);
  const [notificationLoading, setNotificationLoading] = useState(false);
  const [notificationFeedback, setNotificationFeedback] =
    useState<NotificationFeedback | null>(null);

  useEffect(() => {
    const checkAutostartStatus = async () => {
      try {
        const enabled = await isAutostartEnabled();
        setAutostartEnabled(enabled);
      } catch {
        setAutostartErrorMessage('自動起動の状態を確認できませんでした。');
      }
    };

    void checkAutostartStatus();
  }, []);

  const handleAutostartToggle = async (enabled: boolean) => {
    setAutostartLoading(true);
    setAutostartErrorMessage(null);

    try {
      if (enabled) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
      setAutostartEnabled(enabled);
    } catch {
      setAutostartErrorMessage('自動起動の設定を変更できませんでした。');
    } finally {
      setAutostartLoading(false);
    }
  };

  const handleTestNotification = async () => {
    setNotificationLoading(true);
    setNotificationFeedback(null);

    try {
      let permissionGranted = await isPermissionGranted();

      if (!permissionGranted) {
        permissionGranted = (await requestPermission()) === 'granted';
      }

      if (!permissionGranted) {
        setNotificationFeedback({
          type: 'error',
          message: '通知が許可されていません。',
        });
        return;
      }

      sendNotification({
        title: 'Time Is Money',
        body: 'テスト通知です',
      });
      setNotificationFeedback({
        type: 'success',
        message: 'テスト通知を送信しました。',
      });
    } catch {
      setNotificationFeedback({
        type: 'error',
        message: '通知を送信できませんでした。',
      });
    } finally {
      setNotificationLoading(false);
    }
  };

  return (
    <main className="page">
      <h2>Settings</h2>
      <section>
        <h3>一般</h3>
        <label>
          <input
            type="checkbox"
            checked={autostartEnabled}
            onChange={(event) => handleAutostartToggle(event.target.checked)}
            disabled={autostartLoading}
          />
          {autostartLoading
            ? '処理中...'
            : 'PCの起動時にアプリを自動で開く'}
        </label>
        {autostartErrorMessage && (
          <p role="alert">{autostartErrorMessage}</p>
        )}
      </section>

      <section>
        <h3>通知</h3>
        <p>OSの通知機能が利用できるかテストします。</p>
        <button
          type="button"
          onClick={handleTestNotification}
          disabled={notificationLoading}
        >
          {notificationLoading ? '確認中...' : '通知をテスト送信'}
        </button>
        {notificationFeedback && (
          <p role={notificationFeedback.type === 'error' ? 'alert' : 'status'}>
            {notificationFeedback.message}
          </p>
        )}
      </section>

      <section>
        <h3>Web Tracker</h3>
        <p>Chromeで起動しているウェブアプリの利用時間を計測し、ダッシュボードに表示します。</p>
        <details>
          <summary>インストール手順</summary>
          <ol style={{ marginTop: '12px', paddingLeft: '20px' }}>
            <li>Chrome を起動します</li>
            <li><code>chrome://extensions</code> にアクセスします</li>
            <li>右上の「デベロッパー モード」をONにします</li>
            <li>「拡張機能を読み込む」をクリックします</li>
            <li><code>extensions/webtime-tracker</code> フォルダを選択します</li>
            <li>Chrome右上の拡張機能アイコンに「Web Tracker」が表示されたら完了です</li>
          </ol>
        </details>
      </section>
    </main>
  );
}
