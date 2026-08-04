import { useEffect, useState } from 'react';
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';

export function SettingsPage() {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // ページ読込時に現在の自動起動状態を確認
  useEffect(() => {
    checkAutostartStatus();
  }, []);

  // 自動起動状態を確認する関数
  const checkAutostartStatus = async () => {
    try {
      const enabled = await isAutostartEnabled();
      setAutostartEnabled(enabled);
    } catch {
      setErrorMessage('自動起動の状態を確認できませんでした。');
    }
  };

  // トグルが変更されたときの処理
  const handleAutostartToggle = async (enabled: boolean) => {
    setLoading(true);
    setErrorMessage(null);
    try {
      if (enabled) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
      setAutostartEnabled(enabled);
    } catch {
      setErrorMessage('自動起動の設定を変更できませんでした。');
    } finally {
      setLoading(false);
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
            onChange={(e) => handleAutostartToggle(e.target.checked)}
            disabled={loading}
          />
          {loading ? '処理中...' : 'PCの起動時にアプリを自動で開く'}
        </label>
        {errorMessage && <p role="alert">{errorMessage}</p>}
      </section>
    </main>
  );
}
