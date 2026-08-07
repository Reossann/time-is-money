import { useEffect, useRef, useState, type FormEvent } from "react";

import {
  hourlyRateSettingsRepository,
  type HourlyRateSettingsRepository,
} from "../../repositories/hourlyRateSettingsRepository";
import { getActiveWindowInfo } from "../../services/activityService";
import {
  clearAppHourlyRateYen,
  normalizeDesktopAppId,
  registerDesktopApp,
  resolveHourlyRateYen,
  setAppHourlyRateYen,
  setDefaultHourlyRateYen,
} from "../../services/hourlyRateSettingsService";
import type { HourlyRateSettings } from "../../types/hourlyRateSettings";
import {
  hourlyRateYenSchema,
  normalizeDesktopProcessName,
} from "../../utils/hourlyRateSettingsSchemas";

const CAPTURE_COUNTDOWN_SECONDS = 3;

type HourlyRateSettingsSectionProps = Readonly<{
  repository?: HourlyRateSettingsRepository;
  captureActiveWindow?: typeof getActiveWindowInfo;
}>;

function parseHourlyRateDraft(
  draft: string,
  emptyDraftMessage = "デフォルト時給を入力してください。",
): { value: number } | { error: string } {
  if (draft.trim().length === 0) {
    return { error: emptyDraftMessage };
  }

  const result = hourlyRateYenSchema.safeParse(Number(draft));
  if (!result.success) {
    return { error: "0以上の数値を入力してください。" };
  }

  return { value: result.data };
}

export function HourlyRateSettingsSection({
  repository = hourlyRateSettingsRepository,
  captureActiveWindow = getActiveWindowInfo,
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
  const [isAddingCandidate, setIsAddingCandidate] = useState(false);
  const [captureCountdown, setCaptureCountdown] = useState<number | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [candidateProcessName, setCandidateProcessName] = useState<
    string | null
  >(null);
  const [captureErrorMessage, setCaptureErrorMessage] = useState<string | null>(
    null,
  );
  const [captureStatusMessage, setCaptureStatusMessage] = useState<
    string | null
  >(null);
  const [appRateDrafts, setAppRateDrafts] = useState<
    Readonly<Record<string, string>>
  >({});
  const [appValidationErrors, setAppValidationErrors] = useState<
    Readonly<Record<string, string | null>>
  >({});
  const [appSaveErrors, setAppSaveErrors] = useState<
    Readonly<Record<string, string | null>>
  >({});
  const [appStatusMessages, setAppStatusMessages] = useState<
    Readonly<Record<string, string | null>>
  >({});
  const [appSaveOperation, setAppSaveOperation] = useState<{
    appId: string;
    action: "save" | "clear";
  } | null>(null);

  const loadPromiseRef = useRef<Promise<HourlyRateSettings> | null>(null);
  const mountedRef = useRef(false);
  const savingRef = useRef(false);
  const captureTimerRef = useRef<number | null>(null);
  const captureRequestRef = useRef(0);

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

  useEffect(
    () => () => {
      if (captureTimerRef.current !== null) {
        window.clearTimeout(captureTimerRef.current);
        captureTimerRef.current = null;
      }
      captureRequestRef.current += 1;
    },
    [],
  );

  const handleDraftChange = (value: string) => {
    setDefaultRateDraft(value);
    setValidationErrorMessage(null);
    setSaveErrorMessage(null);
    setSaveStatusMessage(null);
  };

  const handleAppDraftChange = (appId: string, value: string) => {
    setAppRateDrafts((current) => ({ ...current, [appId]: value }));
    setAppValidationErrors((current) => ({ ...current, [appId]: null }));
    setAppSaveErrors((current) => ({ ...current, [appId]: null }));
    setAppStatusMessages((current) => ({ ...current, [appId]: null }));
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

  const captureForegroundApp = async (requestId: number) => {
    let activeWindow;
    try {
      activeWindow = await captureActiveWindow();
    } catch {
      if (mountedRef.current && captureRequestRef.current === requestId) {
        setIsCapturing(false);
        setCaptureStatusMessage(null);
        setCaptureErrorMessage(
          "前面アプリの取得に失敗しました。もう一度お試しください。",
        );
      }
      return;
    }

    if (!mountedRef.current || captureRequestRef.current !== requestId) {
      return;
    }

    if (activeWindow === null) {
      setIsCapturing(false);
      setCaptureStatusMessage(null);
      setCaptureErrorMessage(
        "前面アプリを取得できませんでした。対象アプリを前面にして再度お試しください。",
      );
      return;
    }

    let processName: string;
    try {
      processName = normalizeDesktopProcessName(activeWindow.processName);
    } catch {
      setIsCapturing(false);
      setCaptureStatusMessage(null);
      setCaptureErrorMessage(
        "取得したアプリを登録できません。別のアプリでお試しください。",
      );
      return;
    }

    setCandidateProcessName(processName);
    setIsCapturing(false);
    setCaptureStatusMessage(null);
    setCaptureErrorMessage(null);
  };

  const handleStartCapture = () => {
    if (settings === null || isCapturing || savingRef.current) {
      return;
    }

    if (captureTimerRef.current !== null) {
      window.clearTimeout(captureTimerRef.current);
      captureTimerRef.current = null;
    }

    const requestId = captureRequestRef.current + 1;
    captureRequestRef.current = requestId;
    setCandidateProcessName(null);
    setCaptureErrorMessage(null);
    setCaptureStatusMessage(null);
    setIsCapturing(true);
    setCaptureCountdown(CAPTURE_COUNTDOWN_SECONDS);

    const scheduleNextTick = (secondsRemaining: number) => {
      captureTimerRef.current = window.setTimeout(() => {
        captureTimerRef.current = null;

        if (!mountedRef.current || captureRequestRef.current !== requestId) {
          return;
        }

        const nextSeconds = secondsRemaining - 1;
        if (nextSeconds === 0) {
          setCaptureCountdown(null);
          setCaptureStatusMessage("前面アプリを確認しています...");
          void captureForegroundApp(requestId);
          return;
        }

        setCaptureCountdown(nextSeconds);
        scheduleNextTick(nextSeconds);
      }, 1_000);
    };

    scheduleNextTick(CAPTURE_COUNTDOWN_SECONDS);
  };

  const handleCancelCandidate = () => {
    setCandidateProcessName(null);
    setCaptureErrorMessage(null);
    setCaptureStatusMessage("アプリの追加を取り消しました。");
  };

  const handleAddCandidate = async () => {
    if (
      settings === null ||
      candidateProcessName === null ||
      savingRef.current
    ) {
      return;
    }

    const candidateAppId = normalizeDesktopAppId(candidateProcessName);
    if (settings.desktopApps.some((entry) => entry.appId === candidateAppId)) {
      setCandidateProcessName(null);
      setCaptureErrorMessage(null);
      setCaptureStatusMessage("このアプリは登録済みです。");
      return;
    }

    let nextSettings: HourlyRateSettings;
    try {
      nextSettings = registerDesktopApp(candidateProcessName, settings);
    } catch {
      setCaptureErrorMessage(
        "取得したアプリを登録できません。別のアプリでお試しください。",
      );
      setCaptureStatusMessage(null);
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setIsAddingCandidate(true);
    setCaptureErrorMessage(null);
    setCaptureStatusMessage("アプリを追加しています...");

    try {
      const savedSettings = await repository.save(nextSettings);

      if (mountedRef.current) {
        setSettings(savedSettings);
        setCandidateProcessName(null);
        setCaptureStatusMessage("アプリを時給設定へ追加しました。");
      }
    } catch {
      if (mountedRef.current) {
        setCaptureErrorMessage(
          "アプリを追加できませんでした。もう一度お試しください。",
        );
        setCaptureStatusMessage(null);
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) {
        setIsSaving(false);
        setIsAddingCandidate(false);
      }
    }
  };

  const handleSaveAppRate = async (appId: string, processName: string) => {
    if (settings === null || savingRef.current) {
      return;
    }

    const entry = settings.desktopApps.find((app) => app.appId === appId);
    if (entry === undefined) {
      return;
    }

    const draft =
      appRateDrafts[appId] ??
      (entry.hourlyRateYen === null ? "" : String(entry.hourlyRateYen));
    const parsedDraft = parseHourlyRateDraft(
      draft,
      "アプリ別の上書き時給を入力してください。",
    );
    if ("error" in parsedDraft) {
      setAppValidationErrors((current) => ({
        ...current,
        [appId]: parsedDraft.error,
      }));
      setAppSaveErrors((current) => ({ ...current, [appId]: null }));
      setAppStatusMessages((current) => ({ ...current, [appId]: null }));
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setAppSaveOperation({ appId, action: "save" });
    setAppValidationErrors((current) => ({ ...current, [appId]: null }));
    setAppSaveErrors((current) => ({ ...current, [appId]: null }));
    setAppStatusMessages((current) => ({ ...current, [appId]: null }));

    try {
      const nextSettings = setAppHourlyRateYen(
        processName,
        parsedDraft.value,
        settings,
      );
      const savedSettings = await repository.save(nextSettings);

      if (mountedRef.current) {
        const savedEntry = savedSettings.desktopApps.find(
          (app) => app.appId === appId,
        );
        setSettings(savedSettings);
        if (savedEntry !== undefined) {
          setAppRateDrafts((current) => ({
            ...current,
            [appId]:
              savedEntry.hourlyRateYen === null
                ? ""
                : String(savedEntry.hourlyRateYen),
          }));
        }
        setAppStatusMessages((current) => ({
          ...current,
          [appId]: "上書き時給を保存しました。",
        }));
      }
    } catch {
      if (mountedRef.current) {
        setAppSaveErrors((current) => ({
          ...current,
          [appId]: "上書き時給を保存できませんでした。もう一度お試しください。",
        }));
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) {
        setIsSaving(false);
        setAppSaveOperation(null);
      }
    }
  };

  const handleClearAppRate = async (appId: string, processName: string) => {
    if (settings === null || savingRef.current) {
      return;
    }

    const entry = settings.desktopApps.find((app) => app.appId === appId);
    if (entry === undefined || entry.hourlyRateYen === null) {
      return;
    }

    savingRef.current = true;
    setIsSaving(true);
    setAppSaveOperation({ appId, action: "clear" });
    setAppValidationErrors((current) => ({ ...current, [appId]: null }));
    setAppSaveErrors((current) => ({ ...current, [appId]: null }));
    setAppStatusMessages((current) => ({ ...current, [appId]: null }));

    try {
      const nextSettings = clearAppHourlyRateYen(processName, settings);
      const savedSettings = await repository.save(nextSettings);

      if (mountedRef.current) {
        setSettings(savedSettings);
        setAppRateDrafts((current) => ({ ...current, [appId]: "" }));
        setAppStatusMessages((current) => ({
          ...current,
          [appId]: "上書き時給を解除しました。",
        }));
      }
    } catch {
      if (mountedRef.current) {
        setAppSaveErrors((current) => ({
          ...current,
          [appId]: "上書き時給を解除できませんでした。もう一度お試しください。",
        }));
      }
    } finally {
      savingRef.current = false;
      if (mountedRef.current) {
        setIsSaving(false);
        setAppSaveOperation(null);
      }
    }
  };

  const sortedDesktopApps =
    settings === null
      ? []
      : [...settings.desktopApps].sort((left, right) =>
          left.appId.localeCompare(right.appId),
        );
  const isDefaultRateSaving =
    isSaving && !isAddingCandidate && appSaveOperation === null;

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
        <>
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
              {isDefaultRateSaving ? "保存中..." : "デフォルト時給を保存"}
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

          <div className="hourly-rate-settings__capture">
            <div className="hourly-rate-settings__capture-header">
              <h4>Windowsアプリを登録</h4>
              <p>
                取得開始後、3秒以内に時給を設定したいアプリへ切り替えてください。
              </p>
            </div>

            <button
              className="hourly-rate-settings__capture-button"
              type="button"
              onClick={handleStartCapture}
              disabled={isCapturing || isSaving}
            >
              3秒後に前面アプリを取得
            </button>

            {isCapturing && (
              <p className="hourly-rate-settings__capture-progress" role="status">
                {captureCountdown === null
                  ? "前面アプリを確認しています..."
                  : `${captureCountdown}秒後に取得します。対象アプリへ切り替えてください。`}
              </p>
            )}

            {candidateProcessName !== null && (
              <div
                className="hourly-rate-settings__candidate"
                aria-labelledby="hourly-rate-candidate-title"
              >
                <p id="hourly-rate-candidate-title">
                  取得したアプリ: <strong>{candidateProcessName}</strong>
                </p>
                <p>このアプリを時給設定の対象へ追加しますか？</p>
                <div className="hourly-rate-settings__candidate-actions">
                  <button
                    type="button"
                    onClick={() => void handleAddCandidate()}
                    disabled={isSaving}
                  >
                    {isAddingCandidate ? "追加中..." : "追加"}
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelCandidate}
                    disabled={isSaving}
                  >
                    取り消し
                  </button>
                </div>
              </div>
            )}

            {captureErrorMessage !== null && (
              <p className="hourly-rate-settings__message" role="alert">
                {captureErrorMessage}
              </p>
            )}
            {captureStatusMessage !== null && !isCapturing && (
              <p
                className="hourly-rate-settings__message hourly-rate-settings__message--success"
                role="status"
              >
                {captureStatusMessage}
              </p>
            )}

            <div className="hourly-rate-settings__registered-apps">
              <h4>登録済みアプリ</h4>
              {sortedDesktopApps.length === 0 ? (
                <p>登録済みアプリはありません。</p>
              ) : (
                <ul aria-label="登録済みアプリ">
                  {sortedDesktopApps.map((entry) => {
                    const inputId = `app-hourly-rate-${entry.appId}`;
                    const errorId = `${inputId}-error`;
                    const resolvedHourlyRateYen = resolveHourlyRateYen(
                      entry.processName,
                      settings,
                    );
                    const isThisAppSaving =
                      appSaveOperation?.appId === entry.appId;
                    const validationError =
                      appValidationErrors[entry.appId] ?? null;
                    const saveError = appSaveErrors[entry.appId] ?? null;
                    const statusMessage =
                      appStatusMessages[entry.appId] ?? null;
                    const draft =
                      appRateDrafts[entry.appId] ??
                      (entry.hourlyRateYen === null
                        ? ""
                        : String(entry.hourlyRateYen));

                    return (
                      <li
                        className="hourly-rate-settings__app-card"
                        key={entry.appId}
                      >
                        <h5>{entry.processName}</h5>
                        <p className="hourly-rate-settings__active-rate">
                          {entry.hourlyRateYen === null
                            ? `デフォルト時給を使用中: ${resolvedHourlyRateYen}円/時`
                            : `利用中の時給: ${resolvedHourlyRateYen}円/時`}
                        </p>

                        <div className="hourly-rate-settings__field">
                          <label htmlFor={inputId}>
                            {entry.processName}の上書き時給（円/時）
                          </label>
                          <div className="hourly-rate-settings__input-row">
                            <input
                              id={inputId}
                              name={`hourlyRateYen-${entry.appId}`}
                              type="number"
                              min="0"
                              step="any"
                              placeholder="未設定"
                              value={draft}
                              onChange={(event) =>
                                handleAppDraftChange(
                                  entry.appId,
                                  event.target.value,
                                )
                              }
                              disabled={isThisAppSaving}
                              aria-invalid={validationError !== null}
                              aria-describedby={
                                validationError === null ? undefined : errorId
                              }
                            />
                            <span aria-hidden="true">円/時</span>
                          </div>
                          {validationError !== null && (
                            <p id={errorId} role="alert">
                              {validationError}
                            </p>
                          )}
                        </div>

                        <div className="hourly-rate-settings__app-actions">
                          <button
                            type="button"
                            onClick={() =>
                              void handleSaveAppRate(
                                entry.appId,
                                entry.processName,
                              )
                            }
                            disabled={isSaving}
                            aria-label={`${entry.processName}の上書き時給を保存`}
                          >
                            {isThisAppSaving &&
                            appSaveOperation.action === "save"
                              ? "保存中..."
                              : "保存"}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              void handleClearAppRate(
                                entry.appId,
                                entry.processName,
                              )
                            }
                            disabled={isSaving || entry.hourlyRateYen === null}
                            aria-label={`${entry.processName}の上書きを解除`}
                          >
                            {isThisAppSaving &&
                            appSaveOperation.action === "clear"
                              ? "解除中..."
                              : "上書きを解除"}
                          </button>
                        </div>

                        {saveError !== null && (
                          <p
                            className="hourly-rate-settings__message"
                            role="alert"
                          >
                            {saveError}
                          </p>
                        )}
                        {statusMessage !== null && (
                          <p
                            className="hourly-rate-settings__message hourly-rate-settings__message--success"
                            role="status"
                          >
                            {statusMessage}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
