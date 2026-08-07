import { StrictMode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { HourlyRateSettingsRepository } from "../../repositories/hourlyRateSettingsRepository";
import {
  createDefaultHourlyRateSettings,
  setDefaultHourlyRateYen,
} from "../../services/hourlyRateSettingsService";
import type { HourlyRateSettings } from "../../types/hourlyRateSettings";
import { HourlyRateSettingsSection } from "./HourlyRateSettingsSection";

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

async function renderReady(repository = createRepository()) {
  const user = userEvent.setup();
  render(<HourlyRateSettingsSection repository={repository} />);
  const input = await screen.findByRole("spinbutton", {
    name: "デフォルト時給（円/時）",
  });

  return { input, repository, user };
}

describe("HourlyRateSettingsSection", () => {
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
});
