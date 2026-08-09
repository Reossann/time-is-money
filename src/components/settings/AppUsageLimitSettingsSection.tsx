import { useEffect, useState } from "react";
import { appUsageLimitSettingsRepository } from "../../repositories/appUsageLimitSettingsRepository";
import { removeAppUsageLimit, upsertAppUsageLimit } from "../../services/appUsageLimitSettingsService";
import type { AppUsageLimitSetting, AppUsageLimitSettings } from "../../types/appUsageLimitSettings";

const emptyDraft = { processName: "", dailyLimitMinutes: "60", continuousLimitMinutes: "30", cooldownMinutes: "15" };

export function AppUsageLimitSettingsSection() {
  const [settings, setSettings] = useState<AppUsageLimitSettings | null>(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [error, setError] = useState<string | null>(null);
  const [editingAppId, setEditingAppId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void appUsageLimitSettingsRepository.load().then((loaded) => { if (active) setSettings(loaded); }).catch(() => { if (active) setError("利用制限設定を読み込めませんでした。"); });
    return () => { active = false; };
  }, []);

  const save = async (next: AppUsageLimitSettings) => {
    try { const saved = await appUsageLimitSettingsRepository.save(next); setSettings(saved); setError(null); }
    catch { setError("利用制限設定を保存できませんでした。"); }
  };

  const resetDraft = () => { setDraft(emptyDraft); setEditingAppId(null); };

  const submit = async () => {
    if (settings === null) return;
    const daily = Number(draft.dailyLimitMinutes);
    const continuous = Number(draft.continuousLimitMinutes);
    const cooldown = Number(draft.cooldownMinutes);
    if (!draft.processName.trim() || !Number.isInteger(daily) || daily <= 0 || !Number.isInteger(continuous) || continuous <= 0 || !Number.isInteger(cooldown) || cooldown < 0) {
      setError("アプリ名と時間を正しく入力してください。");
      return;
    }
    const existing = editingAppId === null ? undefined : settings.desktopApps.find((entry) => entry.appId === editingAppId);
    const setting: AppUsageLimitSetting = { appId: existing?.appId ?? "pending", processName: draft.processName, dailyLimitSeconds: daily * 60, continuousLimitSeconds: continuous * 60, cooldownSeconds: cooldown * 60, enabled: existing?.enabled ?? true };
    try { await save(upsertAppUsageLimit(setting, settings)); resetDraft(); }
    catch { setError("同じアプリのルールがあるか、入力値が不正です。"); }
  };

  const edit = (entry: AppUsageLimitSetting) => { setEditingAppId(entry.appId); setDraft({ processName: entry.processName, dailyLimitMinutes: String(entry.dailyLimitSeconds / 60), continuousLimitMinutes: String(entry.continuousLimitSeconds / 60), cooldownMinutes: String(entry.cooldownSeconds / 60) }); };

  return <section>
    <h3>アプリ別利用制限</h3>
    {error ? <p role="alert">{error}</p> : null}
    <form onSubmit={(event) => { event.preventDefault(); void submit(); }}>
      <label>アプリ（プロセス名） <input value={draft.processName} onChange={(event) => setDraft({ ...draft, processName: event.target.value })} placeholder="Example.exe" /></label>
      <label>今日の上限（分） <input type="number" min="1" value={draft.dailyLimitMinutes} onChange={(event) => setDraft({ ...draft, dailyLimitMinutes: event.target.value })} /></label>
      <label>連続利用上限（分） <input type="number" min="1" value={draft.continuousLimitMinutes} onChange={(event) => setDraft({ ...draft, continuousLimitMinutes: event.target.value })} /></label>
      <label>通知間隔（分） <input type="number" min="0" value={draft.cooldownMinutes} onChange={(event) => setDraft({ ...draft, cooldownMinutes: event.target.value })} /></label>
      <button type="submit">{editingAppId === null ? "追加" : "更新"}</button>{editingAppId !== null ? <button type="button" onClick={resetDraft}>キャンセル</button> : null}
    </form>
    {settings?.desktopApps.map((entry) => <div key={entry.appId}>
      <span>{entry.processName}（日次 {entry.dailyLimitSeconds / 60}分／連続 {entry.continuousLimitSeconds / 60}分）</span>
      <button type="button" onClick={() => void save(upsertAppUsageLimit({ ...entry, enabled: !entry.enabled }, settings))}>{entry.enabled ? "無効化" : "有効化"}</button>
      <button type="button" onClick={() => edit(entry)}>編集</button>
      <button type="button" onClick={() => void save(removeAppUsageLimit(entry.processName, settings))}>削除</button>
    </div>)}
  </section>;
}
