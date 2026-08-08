import { useEffect, useState } from 'react';
import {
  enable as enableAutostart,
  disable as disableAutostart,
  isEnabled as isAutostartEnabled,
} from '@tauri-apps/plugin-autostart';
import { HourlyRateSettingsSection } from '../components/settings/HourlyRateSettingsSection';
import { createDefaultSettings, loadSettings, saveSettings } from '../services/settingsService';
import type { AppSettings, NotificationIntervalMinutes, NotificationTone } from '../types/settings';

export function SettingsPage() {
  const [autostartEnabled, setAutostartEnabled] = useState(false);
  const [autostartLoading, setAutostartLoading] = useState(false);
  const [autostartErrorMessage, setAutostartErrorMessage] = useState<
    string | null
  >(null);
  const [settings, setSettings] = useState<AppSettings>(createDefaultSettings());
  const [settingsErrorMessage, setSettingsErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const checkAutostartStatus = async () => {
      try {
        const enabled = await isAutostartEnabled();
        setAutostartEnabled(enabled);
      } catch {
        setAutostartErrorMessage('自動起動の状態を確認できませんでした。');
      }
    };

    const initialiseSettings = async () => {
      try {
        const loadedSettings = await loadSettings();
        setSettings(loadedSettings);
      } catch {
        setSettingsErrorMessage('設定を読み込めませんでした。');
      }
    };

    void checkAutostartStatus();
    void initialiseSettings();
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

  const updateSettings = async (nextSettings: AppSettings) => {
    setSettings(nextSettings);

    try {
      await saveSettings(nextSettings);
      setSettingsErrorMessage(null);
    } catch {
      setSettingsErrorMessage('設定を保存できませんでした。');
    }
  };

  const handleToneChange = async (nextTone: NotificationTone) => {
    await updateSettings({ ...settings, notificationTone: nextTone });
  };

  const handleIntervalChange = async (nextInterval: NotificationIntervalMinutes) => {
    await updateSettings({ ...settings, notificationIntervalMinutes: nextInterval });
  };

  return (
    <main className="page">
      <h2>設定</h2>
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
        <h3>通知設定</h3>
        <p>通知の口調と頻度を選択できます。選択した内容は自動で保存されます。</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
          <div>
            <p style={{ margin: '0 0 8px' }}>通知の口調</p>
            <div role="group" aria-label="通知の口調" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {(['sparta', 'gentle'] as NotificationTone[]).map((tone) => {
                const isActive = settings.notificationTone === tone;
                return (
                  <button
                    key={tone}
                    type="button"
                    onClick={() => void handleToneChange(tone)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '999px',
                      border: '1px solid #888',
                      backgroundColor: isActive ? '#2563eb' : '#fff',
                      color: isActive ? '#fff' : '#111',
                      cursor: 'pointer',
                    }}
                  >
                    {tone === 'sparta' ? 'スパルタ' : 'やさしい'}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <p style={{ margin: '0 0 8px' }}>通知間隔</p>
            <div role="group" aria-label="通知間隔" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {([15, 30, 60, 120] as NotificationIntervalMinutes[]).map((interval) => {
                const isActive = settings.notificationIntervalMinutes === interval;
                return (
                  <button
                    key={interval}
                    type="button"
                    onClick={() => void handleIntervalChange(interval)}
                    style={{
                      padding: '8px 12px',
                      borderRadius: '999px',
                      border: '1px solid #888',
                      backgroundColor: isActive ? '#2563eb' : '#fff',
                      color: isActive ? '#fff' : '#111',
                      cursor: 'pointer',
                    }}
                  >
                    {interval === 60 ? '1時間' : interval === 120 ? '2時間' : `${interval}分`}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
        {settingsErrorMessage && <p role="alert">{settingsErrorMessage}</p>}
      </section>

      <section>
        <h3>Web Tracker</h3>
        <p>Chromeで起動しているウェブアプリの利用時間を計測し、タイマー画面に表示します。</p>
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
