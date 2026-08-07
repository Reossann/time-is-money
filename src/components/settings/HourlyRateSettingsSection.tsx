import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  hourlyRateSettingsRepository,
  type HourlyRateSettingsRepository,
} from "../../repositories/hourlyRateSettingsRepository";
import { setDefaultHourlyRateYen } from "../../services/hourlyRateSettingsService";
import type { HourlyRateSettings } from "../../types/hourlyRateSettings";
import { hourlyRateYenSchema } from "../../utils/hourlyRateSettingsSchemas";

type HourlyRateSettingsSectionProps = Readonly<{
  repository?: HourlyRateSettingsRepository;
}>;

function parseHourlyRateDraft(
  draft: string,
): { value: number } | { error: string } {
  if (draft.trim().length === 0) {
    return { error: "デフォルト時給を入力してください。" };
  }

  const result = hourlyRateYenSchema.safeParse(Number(draft));
  if (!result.success) {
    return { error: "0以上の数値を入力してください。" };
  }

  return { value: result.data };
}

export function HourlyRateSettingsSection({
  repository = hourlyRateSettingsRepository,
}: HourlyRateSettingsSectionProps) {
  const [settings, setSettings] = useState<HourlyRateSettings | null>(null);
  const [defaultRateDraft, setDefaultRateDraft] = useState("");
  const [loadErrorMessage, setLoadErrorMessage] = useState<string | null>(null);
  const [validationErrorMessage, setValidationErrorMessage] = useState<
    string | null
  >(null);
  const [saveErrorMessage, setSaveErrorMessage] = useState<string | null>(null);
  const [saveStatusMessage, setSaveStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadPromiseRef = useRef<Promise<HourlyRateSettings> | null>(null);
  const mountedRef = useRef(false);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    mountedRef.current = true;

    loadPromiseRef.current ??= repository.load();
    void loadPromiseRef.current.then(
      (loadedSettings) => {
        if (!active) {
          return;
        }

        setSettings(loadedSettings);
        setDefaultRateDraft(String(loadedSettings.defaultHourlyRateYen));
      },
      () => {
        if (!active) {
          return;
        }

        setLoadErrorMessage("時給設定を読み込めませんでした。");
      },
    );

    return () => {
      active = false;
      mountedRef.current = false;
    };
  }, [repository]);

  const handleDraftChange = (value: string) => {
    setDefaultRateDraft(value);
    setValidationErrorMessage(null);
    setSaveErrorMessage(null);
    setSaveStatusMessage(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (settings === null || savingRef.current) {
      return;
    }

    const parsedDraft = parseHourlyRateDraft(defaultRateDraft);
    if ("error" in parsedDraft) {
      setValidationErrorMessage(parsedDraft.error);
      setSaveErrorMessage(null);
      setSaveStatusMessage(null);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setValidationErrorMessage(null);
    setSaveErrorMessage(null);
    setSaveStatusMessage(null);

    try {
      const nextSettings = setDefaultHourlyRateYen(
        parsedDraft.value,
        settings,
      );
      const savedSettings = await repository.save(nextSettings);

      if (mountedRef.current) {
        setSettings(savedSettings);
        setDefaultRateDraft(String(savedSettings.defaultHourlyRateYen));
        setSaveStatusMessage("デフォルト時給を保存しました。");
      }
    } catch {
      if (mountedRef.current) {
        setSaveErrorMessage(
          "デフォルト時給を保存できませんでした。もう一度お試しください。",
        );
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) {
        setIsSaving(false);
      }
    }
  };

  return (
    <section
      className="hourly-rate-settings"
      aria-labelledby="hourly-rate-settings-title"
    >
      <div className="hourly-rate-settings__header">
        <h3 id="hourly-rate-settings-title">時給設定</h3>
        <p>アプリごとの設定がない場合に使う共通の時給です。</p>
      </div>

      {loadErrorMessage !== null ? (
        <p className="hourly-rate-settings__message" role="alert">
          {loadErrorMessage}
        </p>
      ) : settings === null ? (
        <p className="hourly-rate-settings__message" role="status">
          時給設定を読み込んでいます...
        </p>
      ) : (
        <form
          className="hourly-rate-settings__form"
          onSubmit={handleSave}
          noValidate
        >
          <p className="hourly-rate-settings__saved-value">
            保存済みの時給: {settings.defaultHourlyRateYen} 円/時
          </p>

          <div className="hourly-rate-settings__field">
            <label htmlFor="default-hourly-rate">
              デフォルト時給（円/時）
            </label>
            <div className="hourly-rate-settings__input-row">
              <input
                id="default-hourly-rate"
                name="defaultHourlyRateYen"
                type="number"
                min="0"
                step="any"
                value={defaultRateDraft}
                onChange={(event) => handleDraftChange(event.target.value)}
                disabled={isSaving}
                aria-invalid={validationErrorMessage !== null}
                aria-describedby={
                  validationErrorMessage === null
                    ? undefined
                    : "default-hourly-rate-error"
                }
              />
              <span aria-hidden="true">円/時</span>
            </div>
            {validationErrorMessage !== null && (
              <p id="default-hourly-rate-error" role="alert">
                {validationErrorMessage}
              </p>
            )}
          </div>

          <button
            className="hourly-rate-settings__save-button"
            type="submit"
            disabled={isSaving}
          >
            {isSaving ? "保存中..." : "デフォルト時給を保存"}
          </button>

          {saveErrorMessage !== null && (
            <p className="hourly-rate-settings__message" role="alert">
              {saveErrorMessage}
            </p>
          )}
          {saveStatusMessage !== null && (
            <p
              className="hourly-rate-settings__message hourly-rate-settings__message--success"
              role="status"
            >
              {saveStatusMessage}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
