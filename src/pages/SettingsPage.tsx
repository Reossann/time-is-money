import { useEffect, useState } from 'react';
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';

export function SettingsPage() {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [loading, setLoading] = useState(false);

  // ページ読込時に現在の自動起動状態を確認
  useEffect(() => {
    checkAutostartStatus();
  }, []);

  // 自動起動状態を確認する関数
  const checkAutostartStatus = async () => {
    try {
      const enabled = await isAutostartEnabled();
      setAutostartEnabled(enabled);
    } catch (error) {
      console.error('自動起動状態確認失敗:', error);
    }
  };

  // トグルが変更されたときの処理
  const handleAutostartToggle = async (enabled: boolean) => {
    setLoading(true);
    try {
      if (enabled) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
      setAutostartEnabled(enabled);
    } catch (error) {
      console.error('自動起動設定失敗:', error);
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
      </section>
    </main>
  );
}
