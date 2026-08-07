import { useEffect, useState } from 'react';
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';
import { HourlyRateSettingsSection } from '../components/settings/HourlyRateSettingsSection';

export function SettingsPage() {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [autostartErrorMessage, setAutostartErrorMessage] = useState<
    string | null
  >(null);

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

      <HourlyRateSettingsSection />

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
