import { sendNotification } from '@tauri-apps/plugin-notification';

export function SettingsPage() {
  const handleTestNotification = async () => {
    await sendNotification({
      title: 'Time Is Money',
      body: 'テスト通知です',
    });
  };

  return (
    <main className="page">
      <h2>Settings</h2>
      <p>時間価値や通知などの基本設定を管理する予定の画面です。</p>
      {/* 動作確認用。後で削除してOK */}
      <button onClick={handleTestNotification}>通知をテスト送信</button>
    </main>
  );
}
