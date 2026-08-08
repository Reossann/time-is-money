import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  appCategorySettingsRepository,
  type AppCategorySettingsRepository,
} from "../../repositories/appCategorySettingsRepository";
import {
  hourlyRateSettingsRepository,
  type HourlyRateSettingsRepository,
} from "../../repositories/hourlyRateSettingsRepository";
import {
  removeAppCategory,
  setAppCategory,
} from "../../services/appCategorySettingsService";
import type { ActivityCategory } from "../../types/activity";
import type { AppCategorySettings } from "../../types/appCategorySettings";
import type { HourlyRateSettings } from "../../types/hourlyRateSettings";

const categoryLabels: Record<ActivityCategory, string> = {
  productive: "獲得",
  waste: "浪費",
  neutral: "中立",
};

type AppCategorySettingsSectionProps = Readonly<{
  repository?: AppCategorySettingsRepository;
  hourlyRateRepository?: Pick<HourlyRateSettingsRepository, "load">;
}>;

export function AppCategorySettingsSection({
  repository = appCategorySettingsRepository,
  hourlyRateRepository = hourlyRateSettingsRepository,
}: AppCategorySettingsSectionProps) {
  const [settings, setSettings] = useState<AppCategorySettings | null>(null);
  const [hourlyRateSettings, setHourlyRateSettings] =
    useState<HourlyRateSettings | null>(null);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [category, setCategory] = useState<ActivityCategory>("productive");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [registeredAppsError, setRegisteredAppsError] = useState<string | null>(
    null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [activeAppId, setActiveAppId] = useState<string | null>(null);
  const mountedRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;

    void repository.load().then(
      (loaded) => {
        if (active) setSettings(loaded);
      },
      () => {
        if (active) setLoadError("分類設定を読み込めませんでした。");
      },
    );
    void hourlyRateRepository.load().then(
      (loaded) => {
        if (active) setHourlyRateSettings(loaded);
      },
      () => {
        if (active) {
          setRegisteredAppsError("登録済みアプリを読み込めませんでした。");
        }
      },
    );

    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [repository, hourlyRateRepository]);

  const save = async (
    appId: string,
    nextSettings: AppCategorySettings,
    successMessage: string,
  ) => {
    if (savingRef.current) return;

    savingRef.current = true;
    setActiveAppId(appId);
    setSaveError(null);
    setStatus(null);
    try {
      const saved = await repository.save(nextSettings);
      if (mountedRef.current) {
        setSettings(saved);
        setStatus(successMessage);
      }
    } catch {
      if (mountedRef.current) {
        setSaveError("分類設定を保存できませんでした。");
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setActiveAppId(null);
    }
  };

  const addOrUpdate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (settings === null) return;

    const selectedApp = hourlyRateSettings?.desktopApps.find(
      (entry) => entry.appId === selectedAppId,
    );
    if (!selectedApp) {
      setFormError("時給設定で登録済みのアプリを選択してください。");
      return;
    }

    const existing = settings.desktopApps.some(
      (entry) => entry.appId === selectedApp.appId,
    );
    setFormError(null);
    await save(
      "form",
      setAppCategory(selectedApp.processName, category, settings),
      existing ? "アプリ分類を更新しました。" : "アプリ分類を追加しました。",
    );
    if (mountedRef.current) setSelectedAppId("");
  };

  const updateCategory = async (
    processNameForApp: string,
    nextCategory: ActivityCategory,
  ) => {
    if (settings === null) return;
    await save(
      processNameForApp.toLowerCase(),
      setAppCategory(processNameForApp, nextCategory, settings),
      "アプリ分類を更新しました。",
    );
  };

  const remove = async (processNameForApp: string, appId: string) => {
    if (settings === null) return;
    await save(
      appId,
      removeAppCategory(processNameForApp, settings),
      "アプリ分類を削除しました。",
    );
  };

  return (
    <section className="app-category-settings" aria-labelledby="app-category-heading">
      <h3 id="app-category-heading">アプリ分類</h3>
      <p>
        時給設定で登録したアプリごとに分類を設定します。未設定のアプリは未分類となり、獲得・浪費額は0円です。
      </p>

      {loadError ? <p role="alert">{loadError}</p> : null}
      {registeredAppsError ? <p role="alert">{registeredAppsError}</p> : null}
      {settings === null && !loadError ? <p>分類設定を読み込み中です。</p> : null}

      {settings ? (
        <>
          <form onSubmit={(event) => void addOrUpdate(event)}>
            <label>
              登録済みアプリ
              <select
                aria-label="分類する登録済みアプリ"
                value={selectedAppId}
                onChange={(event) => {
                  setSelectedAppId(event.target.value);
                  setFormError(null);
                }}
                disabled={activeAppId !== null || hourlyRateSettings === null}
              >
                <option value="">選択してください</option>
                {hourlyRateSettings?.desktopApps.map((entry) => (
                  <option key={entry.appId} value={entry.appId}>
                    {entry.processName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              分類
              <select
                aria-label="追加する分類"
                value={category}
                onChange={(event) =>
                  setCategory(event.target.value as ActivityCategory)
                }
                disabled={activeAppId !== null}
              >
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              disabled={activeAppId !== null || hourlyRateSettings === null}
            >
              {activeAppId === "form" ? "保存中..." : "追加・更新"}
            </button>
          </form>

          {formError ? <p role="alert">{formError}</p> : null}
          {saveError ? <p role="alert">{saveError}</p> : null}
          {status ? <p role="status">{status}</p> : null}
          {hourlyRateSettings?.desktopApps.length === 0 ? (
            <p>時給設定でアプリを登録すると、ここで分類を選べます。</p>
          ) : null}

          {settings.desktopApps.length === 0 ? (
            <p>まだ分類済みのアプリはありません。</p>
          ) : (
            <ul className="app-category-settings__list">
              {settings.desktopApps.map((entry) => (
                <li key={entry.appId}>
                  <strong>{entry.processName}</strong>
                  <select
                    aria-label={`${entry.processName}の分類`}
                    value={entry.category}
                    onChange={(event) =>
                      void updateCategory(
                        entry.processName,
                        event.target.value as ActivityCategory,
                      )
                    }
                    disabled={activeAppId !== null}
                  >
                    {Object.entries(categoryLabels).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void remove(entry.processName, entry.appId)}
                    disabled={activeAppId !== null}
                  >
                    削除
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </section>
  );
}
