import { StrictMode } from "react";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { HourlyRateSettingsRepository } from "../../repositories/hourlyRateSettingsRepository";
import {
  createDefaultHourlyRateSettings,
  registerDesktopApp,
  resolveHourlyRateYen,
  setAppHourlyRateYen,
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

function createSettingsWithRegisteredApps() {
  let settings = setDefaultHourlyRateYen(
    3_000,
    createDefaultHourlyRateSettings(),
  );
  settings = registerDesktopApp("notepad.exe", settings);
  return registerDesktopApp("Code.exe", settings);
}

function getAppCard(processName: string) {
  const heading = screen.getByRole("heading", {
    level: 5,
    name: processName,
  });
  const card = heading.closest("li");

  if (card === null) {
    throw new Error(`app card was not found: ${processName}`);
  }

  return within(card);
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

  it("sorts registered apps by ID and shows the resolved default rate", async () => {
    const settings = createSettingsWithRegisteredApps();
    await renderReady(createRepository(settings));

    const appHeadings = within(
      screen.getByRole("list", { name: "登録済みアプリ" }),
    ).getAllByRole("heading", { level: 5 });
    expect(appHeadings.map((heading) => heading.textContent)).toEqual([
      "Code.exe",
      "notepad.exe",
    ]);

    const resolvedCodeRate = resolveHourlyRateYen("Code.exe", settings);
    expect(resolvedCodeRate).toBe(3_000);
    expect(
      getAppCard("Code.exe").getByText(
        `デフォルト時給を使用中: ${resolvedCodeRate}円/時`,
      ),
    ).toBeInTheDocument();
    expect(
      getAppCard("Code.exe").getByRole("spinbutton", {
        name: "Code.exeの上書き時給（円/時）",
      }),
    ).toHaveValue(null);
  });

  it("saves a fractional app rate and can change it to explicit zero", async () => {
    const settings = createSettingsWithRegisteredApps();
    const { repository, user } = await renderReady(createRepository(settings));
    const codeInput = getAppCard("Code.exe").getByRole("spinbutton", {
      name: "Code.exeの上書き時給（円/時）",
    });
    const saveButton = getAppCard("Code.exe").getByRole("button", {
      name: "Code.exeの上書き時給を保存",
    });

    await user.type(codeInput, "1500.5");
    await user.click(saveButton);

    expect(repository.save).toHaveBeenCalledOnce();
    expect(repository.save.mock.calls[0][0].desktopApps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ appId: "code.exe", hourlyRateYen: 1500.5 }),
        expect.objectContaining({
          appId: "notepad.exe",
          hourlyRateYen: null,
        }),
      ]),
    );
    expect(
      getAppCard("Code.exe").getByText("利用中の時給: 1500.5円/時"),
    ).toBeInTheDocument();

    await user.clear(codeInput);
    await user.type(codeInput, "0");
    await user.click(saveButton);

    expect(repository.save).toHaveBeenCalledTimes(2);
    expect(
      getAppCard("Code.exe").getByText("利用中の時給: 0円/時"),
    ).toBeInTheDocument();
    expect(
      repository.save.mock.calls[1][0].desktopApps.find(
        (entry) => entry.appId === "code.exe",
      )?.hourlyRateYen,
    ).toBe(0);
  });

  it("validates an app draft with Zod before saving", async () => {
    const settings = createSettingsWithRegisteredApps();
    const { repository, user } = await renderReady(createRepository(settings));
    const codeCard = getAppCard("Code.exe");
    const codeInput = codeCard.getByRole("spinbutton", {
      name: "Code.exeの上書き時給（円/時）",
    });
    const saveButton = codeCard.getByRole("button", {
      name: "Code.exeの上書き時給を保存",
    });

    await user.click(saveButton);
    expect(codeCard.getByRole("alert")).toHaveTextContent(
      "アプリ別の上書き時給を入力してください。",
    );

    await user.type(codeInput, "-1");
    await user.click(saveButton);
    expect(codeCard.getByRole("alert")).toHaveTextContent(
      "0以上の数値を入力してください。",
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("clears only the override while keeping the registered app", async () => {
    const settings = setAppHourlyRateYen(
      "Code.exe",
      1_500.5,
      createSettingsWithRegisteredApps(),
    );
    const { repository, user } = await renderReady(createRepository(settings));

    await user.click(
      getAppCard("Code.exe").getByRole("button", {
        name: "Code.exeの上書きを解除",
      }),
    );

    const savedSettings = repository.save.mock.calls[0][0];
    expect(savedSettings.desktopApps).toHaveLength(2);
    expect(
      savedSettings.desktopApps.find((entry) => entry.appId === "code.exe"),
    ).toEqual({
      appId: "code.exe",
      processName: "Code.exe",
      hourlyRateYen: null,
    });
    expect(
      getAppCard("Code.exe").getByText(
        "デフォルト時給を使用中: 3000円/時",
      ),
    ).toBeInTheDocument();
    expect(
      getAppCard("Code.exe").getByRole("spinbutton", {
        name: "Code.exeの上書き時給（円/時）",
      }),
    ).toHaveValue(null);
    expect(
      getAppCard("Code.exe").getByRole("button", {
        name: "Code.exeの上書きを解除",
      }),
    ).toBeDisabled();
    expect(getAppCard("Code.exe").getByRole("status")).toHaveTextContent(
      "上書き時給を解除しました。",
    );
  });

  it("keeps the app draft and confirmed rate when saving fails", async () => {
    const settings = setAppHourlyRateYen(
      "Code.exe",
      1_500,
      createSettingsWithRegisteredApps(),
    );
    const repository = createRepository(settings);
    repository.save.mockRejectedValue(new Error("PRIVATE save error"));
    const { user } = await renderReady(repository);
    const codeCard = getAppCard("Code.exe");
    const codeInput = codeCard.getByRole("spinbutton", {
      name: "Code.exeの上書き時給（円/時）",
    });

    await user.clear(codeInput);
    await user.type(codeInput, "4500");
    await user.click(
      codeCard.getByRole("button", {
        name: "Code.exeの上書き時給を保存",
      }),
    );

    expect(codeInput).toHaveValue(4500);
    expect(codeCard.getByText("利用中の時給: 1500円/時")).toBeInTheDocument();
    expect(codeCard.getByRole("alert")).toHaveTextContent(
      "上書き時給を保存できませんでした。もう一度お試しください。",
    );
  });

  it("keeps another app draft and separates per-app status messages", async () => {
    const settings = createSettingsWithRegisteredApps();
    const repository = createRepository(settings);
    const deferred = createDeferred<HourlyRateSettings>();
    repository.save.mockReturnValue(deferred.promise);
    const { user } = await renderReady(repository);
    const codeCard = getAppCard("Code.exe");
    const notepadCard = getAppCard("notepad.exe");
    const codeInput = codeCard.getByRole("spinbutton", {
      name: "Code.exeの上書き時給（円/時）",
    });
    const notepadInput = notepadCard.getByRole("spinbutton", {
      name: "notepad.exeの上書き時給（円/時）",
    });

    await user.type(codeInput, "1500.5");
    await user.type(notepadInput, "2200");
    fireEvent.click(
      codeCard.getByRole("button", {
        name: "Code.exeの上書き時給を保存",
      }),
    );
    fireEvent.click(
      codeCard.getByRole("button", {
        name: "Code.exeの上書き時給を保存",
      }),
    );

    expect(repository.save).toHaveBeenCalledOnce();
    expect(codeInput).toBeDisabled();
    expect(notepadInput).not.toBeDisabled();
    expect(notepadInput).toHaveValue(2200);

    await act(async () => {
      deferred.resolve(setAppHourlyRateYen("Code.exe", 1_500.5, settings));
      await deferred.promise;
    });

    expect(notepadInput).toHaveValue(2200);
    expect(codeCard.getByRole("status")).toHaveTextContent(
      "上書き時給を保存しました。",
    );
    expect(notepadCard.queryByRole("status")).not.toBeInTheDocument();
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
