import { StrictMode } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HourlyRateSettingsRepository } from "../../repositories/hourlyRateSettingsRepository";
import {
  createDefaultHourlyRateSettings,
  registerDesktopApp,
  setDefaultHourlyRateYen,
} from "../../services/hourlyRateSettingsService";
import type { ActiveWindowInfo } from "../../types/activity";
import type { HourlyRateSettings } from "../../types/hourlyRateSettings";
import { HourlyRateSettingsSection } from "./HourlyRateSettingsSection";

const capturedCodeWindow = {
  processName: "Code.exe",
  windowTitle: "PRIVATE project name - Visual Studio Code",
  processId: 42_424,
} as const satisfies ActiveWindowInfo;

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return { promise, reject, resolve };
}

function createRepository(
  settings: HourlyRateSettings = createDefaultHourlyRateSettings(),
): HourlyRateSettingsRepository & {
  load: ReturnType<typeof vi.fn<() => Promise<HourlyRateSettings>>>;
  save: ReturnType<
    typeof vi.fn<(value: HourlyRateSettings) => Promise<HourlyRateSettings>>
  >;
} {
  return {
    load: vi.fn().mockResolvedValue(settings),
    save: vi.fn().mockImplementation(async (value) => value),
  };
}

async function renderReady(
  repository = createRepository(),
  captureActiveWindow: () => Promise<ActiveWindowInfo | null> = vi
    .fn()
    .mockResolvedValue(null),
) {
  const user = userEvent.setup();
  const renderResult = render(
    <HourlyRateSettingsSection
      repository={repository}
      captureActiveWindow={captureActiveWindow}
    />,
  );
  const input = await screen.findByRole("spinbutton", {
    name: "デフォルト時給（円/時）",
  });

  return { input, repository, unmount: renderResult.unmount, user };
}

async function renderAfterCapture(
  captureActiveWindow: ReturnType<
    typeof vi.fn<() => Promise<ActiveWindowInfo | null>>
  >,
  repository = createRepository(),
) {
  await renderReady(repository, captureActiveWindow);
  vi.useFakeTimers();

  fireEvent.click(
    screen.getByRole("button", { name: "3秒後に前面アプリを取得" }),
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(3_000);
  });

  return { repository };
}

async function clickAndFlush(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
    await Promise.resolve();
  });
}

describe("HourlyRateSettingsSection", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows loading before the repository load finishes", () => {
    const deferred = createDeferred<HourlyRateSettings>();
    const repository = createRepository();
    repository.load.mockReturnValue(deferred.promise);

    render(<HourlyRateSettingsSection repository={repository} />);

    expect(screen.getByRole("status")).toHaveTextContent(
      "時給設定を読み込んでいます...",
    );
  });

  it("loads and displays the initial zero rate without saving", async () => {
    const { input, repository } = await renderReady();

    expect(input).toHaveValue(0);
    expect(screen.getByText("保存済みの時給: 0 円/時")).toBeInTheDocument();
    expect(repository.load).toHaveBeenCalledOnce();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("loads only once and never saves during StrictMode effect replay", async () => {
    const repository = createRepository();

    render(
      <StrictMode>
        <HourlyRateSettingsSection repository={repository} />
      </StrictMode>,
    );

    await screen.findByRole("spinbutton", {
      name: "デフォルト時給（円/時）",
    });
    expect(repository.load).toHaveBeenCalledOnce();
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("shows a load error without rendering the form", async () => {
    const repository = createRepository();
    repository.load.mockRejectedValue(new Error("load failed"));

    render(<HourlyRateSettingsSection repository={repository} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "時給設定を読み込めませんでした。",
    );
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
  });

  it("saves a fractional rate and updates the confirmed value", async () => {
    const { input, repository, user } = await renderReady();

    await user.clear(input);
    await user.type(input, "1234.5");
    await user.click(
      screen.getByRole("button", { name: "デフォルト時給を保存" }),
    );

    expect(repository.save).toHaveBeenCalledOnce();
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ defaultHourlyRateYen: 1234.5 }),
    );
    expect(screen.getByText("保存済みの時給: 1234.5 円/時")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "デフォルト時給を保存しました。",
    );
  });

  it("does not convert an empty draft to zero", async () => {
    const settings = setDefaultHourlyRateYen(
      3_000,
      createDefaultHourlyRateSettings(),
    );
    const { input, repository, user } = await renderReady(
      createRepository(settings),
    );

    await user.clear(input);
    await user.click(
      screen.getByRole("button", { name: "デフォルト時給を保存" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "デフォルト時給を入力してください。",
    );
    expect(repository.save).not.toHaveBeenCalled();
    expect(screen.getByText("保存済みの時給: 3000 円/時")).toBeInTheDocument();
  });

  it("rejects a negative draft before calling the repository", async () => {
    const { input, repository, user } = await renderReady();

    await user.clear(input);
    await user.type(input, "-1");
    await user.click(
      screen.getByRole("button", { name: "デフォルト時給を保存" }),
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "0以上の数値を入力してください。",
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("keeps the draft and confirmed value when saving fails", async () => {
    const settings = setDefaultHourlyRateYen(
      3_000,
      createDefaultHourlyRateSettings(),
    );
    const repository = createRepository(settings);
    repository.save.mockRejectedValue(new Error("save failed"));
    const { input, user } = await renderReady(repository);

    await user.clear(input);
    await user.type(input, "4500");
    await user.click(
      screen.getByRole("button", { name: "デフォルト時給を保存" }),
    );

    expect(input).toHaveValue(4500);
    expect(screen.getByText("保存済みの時給: 3000 円/時")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "デフォルト時給を保存できませんでした。もう一度お試しください。",
    );
  });

  it("disables the form and ignores repeated clicks while saving", async () => {
    const deferred = createDeferred<HourlyRateSettings>();
    const repository = createRepository();
    repository.save.mockReturnValue(deferred.promise);
    const { input, user } = await renderReady(repository);

    await user.clear(input);
    await user.type(input, "3000");
    const saveButton = screen.getByRole("button", {
      name: "デフォルト時給を保存",
    });
    await user.dblClick(saveButton);

    expect(repository.save).toHaveBeenCalledOnce();
    expect(input).toBeDisabled();
    expect(screen.getByRole("button", { name: "保存中..." })).toBeDisabled();

    deferred.resolve(
      setDefaultHourlyRateYen(3_000, createDefaultHourlyRateSettings()),
    );
    expect(
      await screen.findByText("保存済みの時給: 3000 円/時"),
    ).toBeInTheDocument();
  });

  it("does not update state after unmounting during load", async () => {
    const deferred = createDeferred<HourlyRateSettings>();
    const repository = createRepository();
    repository.load.mockReturnValue(deferred.promise);
    const { unmount } = render(
      <HourlyRateSettingsSection repository={repository} />,
    );

    unmount();
    deferred.resolve(createDefaultHourlyRateSettings());
    await expect(deferred.promise).resolves.toEqual(
      createDefaultHourlyRateSettings(),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("waits three seconds, announces the countdown, and captures once", async () => {
    const captureActiveWindow = vi.fn().mockResolvedValue(capturedCodeWindow);
    await renderReady(createRepository(), captureActiveWindow);
    vi.useFakeTimers();
    const captureButton = screen.getByRole("button", {
      name: "3秒後に前面アプリを取得",
    });

    fireEvent.click(captureButton);

    expect(captureButton).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "3秒後に取得します。対象アプリへ切り替えてください。",
    );
    expect(captureActiveWindow).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("2秒後に取得します。");
    expect(captureActiveWindow).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("1秒後に取得します。");
    expect(captureActiveWindow).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    expect(captureActiveWindow).toHaveBeenCalledOnce();
    expect(screen.getByText("Code.exe")).toBeInTheDocument();
  });

  it("keeps only the process name and saves after confirmation", async () => {
    const captureActiveWindow = vi.fn().mockResolvedValue(capturedCodeWindow);
    const { repository } = await renderAfterCapture(captureActiveWindow);

    expect(repository.save).not.toHaveBeenCalled();
    expect(screen.getByText("Code.exe")).toBeInTheDocument();
    expect(
      screen.queryByText(capturedCodeWindow.windowTitle),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(String(capturedCodeWindow.processId)),
    ).not.toBeInTheDocument();

    await clickAndFlush(screen.getByRole("button", { name: "追加" }));

    expect(repository.save).toHaveBeenCalledOnce();
    const savedSettings = repository.save.mock.calls[0][0];
    expect(savedSettings.desktopApps).toEqual([
      {
        appId: "code.exe",
        processName: "Code.exe",
        hourlyRateYen: null,
      },
    ]);
    expect(JSON.stringify(savedSettings)).not.toContain(
      capturedCodeWindow.windowTitle,
    );
    expect(JSON.stringify(savedSettings)).not.toContain(
      String(capturedCodeWindow.processId),
    );
    expect(screen.getByRole("list", { name: "登録済みアプリ" })).toHaveTextContent(
      "Code.exe",
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "アプリを時給設定へ追加しました。",
    );
  });

  it("cancels a candidate without saving it", async () => {
    const captureActiveWindow = vi.fn().mockResolvedValue(capturedCodeWindow);
    const { repository } = await renderAfterCapture(captureActiveWindow);

    await clickAndFlush(screen.getByRole("button", { name: "取り消し" }));

    expect(repository.save).not.toHaveBeenCalled();
    expect(screen.queryByText("Code.exe")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "アプリの追加を取り消しました。",
    );
  });

  it("reports a case-insensitive duplicate without saving", async () => {
    const settings = registerDesktopApp(
      "Code.exe",
      createDefaultHourlyRateSettings(),
    );
    const repository = createRepository(settings);
    const captureActiveWindow = vi.fn().mockResolvedValue({
      ...capturedCodeWindow,
      processName: "CODE.EXE",
    });
    await renderAfterCapture(captureActiveWindow, repository);

    await clickAndFlush(screen.getByRole("button", { name: "追加" }));

    expect(repository.save).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent(
      "このアプリは登録済みです。",
    );
    expect(settings.desktopApps).toHaveLength(1);
  });

  it("shows a safe error when there is no foreground window", async () => {
    const captureActiveWindow = vi.fn().mockResolvedValue(null);

    await renderAfterCapture(captureActiveWindow);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "前面アプリを取得できませんでした。対象アプリを前面にして再度お試しください。",
    );
    expect(screen.queryByRole("button", { name: "追加" })).not.toBeInTheDocument();
  });

  it("hides Command error details from the user", async () => {
    const privateError = "PRIVATE window title from Command";
    const captureActiveWindow = vi.fn().mockRejectedValue(new Error(privateError));

    await renderAfterCapture(captureActiveWindow);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "前面アプリの取得に失敗しました。もう一度お試しください。",
    );
    expect(screen.queryByText(privateError)).not.toBeInTheDocument();
  });

  it("rejects an invalid process name before creating a candidate", async () => {
    const captureActiveWindow = vi.fn().mockResolvedValue({
      ...capturedCodeWindow,
      processName: "C:\\Private\\Code.exe",
    });

    await renderAfterCapture(captureActiveWindow);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "取得したアプリを登録できません。別のアプリでお試しください。",
    );
    expect(screen.queryByRole("button", { name: "追加" })).not.toBeInTheDocument();
    expect(screen.queryByText("C:\\Private\\Code.exe")).not.toBeInTheDocument();
  });

  it("keeps the candidate when app registration save fails", async () => {
    const repository = createRepository();
    repository.save.mockRejectedValue(new Error("PRIVATE store failure"));
    const captureActiveWindow = vi.fn().mockResolvedValue(capturedCodeWindow);
    await renderAfterCapture(captureActiveWindow, repository);

    await clickAndFlush(screen.getByRole("button", { name: "追加" }));

    expect(screen.getByText("Code.exe")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "アプリを追加できませんでした。もう一度お試しください。",
    );
    expect(screen.getByText("登録済みアプリはありません。")).toBeInTheDocument();
  });

  it("clears the old candidate when capturing again", async () => {
    const captureActiveWindow = vi
      .fn<() => Promise<ActiveWindowInfo | null>>()
      .mockResolvedValueOnce(capturedCodeWindow)
      .mockResolvedValueOnce({
        processName: "notepad.exe",
        windowTitle: "PRIVATE note",
        processId: 7_777,
      });
    await renderAfterCapture(captureActiveWindow);

    fireEvent.click(
      screen.getByRole("button", { name: "3秒後に前面アプリを取得" }),
    );
    expect(screen.queryByText("Code.exe")).not.toBeInTheDocument();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });

    expect(captureActiveWindow).toHaveBeenCalledTimes(2);
    expect(screen.getByText("notepad.exe")).toBeInTheDocument();
  });

  it("clears the countdown timer when unmounted", async () => {
    const captureActiveWindow = vi.fn().mockResolvedValue(capturedCodeWindow);
    const { unmount } = await renderReady(
      createRepository(),
      captureActiveWindow,
    );
    vi.useFakeTimers();

    fireEvent.click(
      screen.getByRole("button", { name: "3秒後に前面アプリを取得" }),
    );
    unmount();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_000);
    });
    expect(captureActiveWindow).not.toHaveBeenCalled();
  });
});
