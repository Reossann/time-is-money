import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AppCategorySettingsRepository } from "../../repositories/appCategorySettingsRepository";
import { createDefaultAppCategorySettings } from "../../services/appCategorySettingsService";
import {
  createDefaultHourlyRateSettings,
  registerDesktopApp,
} from "../../services/hourlyRateSettingsService";
import type { HourlyRateSettingsRepository } from "../../repositories/hourlyRateSettingsRepository";
import type { AppCategorySettings } from "../../types/appCategorySettings";
import { AppCategorySettingsSection } from "./AppCategorySettingsSection";

function createRepository(
  initial: AppCategorySettings = createDefaultAppCategorySettings(),
): AppCategorySettingsRepository & {
  save: ReturnType<typeof vi.fn>;
} {
  let settings = initial;
  return {
    load: vi.fn(async () => settings),
    save: vi.fn(async (next: AppCategorySettings) => {
      settings = next;
      return settings;
    }),
  };
}

function createHourlyRateRepository(
  registeredApps = registerDesktopApp(
    "Code.exe",
    createDefaultHourlyRateSettings(),
  ),
): Pick<HourlyRateSettingsRepository, "load"> {
  return { load: vi.fn(async () => registeredApps) };
}

describe("AppCategorySettingsSection", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("adds, updates, and removes a category without duplicate app IDs", async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    render(
      <AppCategorySettingsSection
        repository={repository}
        hourlyRateRepository={createHourlyRateRepository()}
      />,
    );

    await screen.findByText("まだ分類済みのアプリはありません。");
    await user.selectOptions(
      screen.getByLabelText("分類する登録済みアプリ"),
      "code.exe",
    );
    await user.selectOptions(screen.getByLabelText("追加する分類"), "productive");
    await user.click(screen.getByRole("button", { name: "追加・更新" }));

    await screen.findByText("アプリ分類を追加しました。");
    expect(screen.getByLabelText("Code.exeの分類")).toHaveValue(
      "productive",
    );
    expect(repository.save).toHaveBeenLastCalledWith({
      schemaVersion: 1,
      desktopApps: [
        { appId: "code.exe", processName: "Code.exe", category: "productive" },
      ],
    });

    await user.selectOptions(screen.getByLabelText("Code.exeの分類"), "waste");
    await screen.findByText("アプリ分類を更新しました。");
    expect(repository.save).toHaveBeenLastCalledWith({
      schemaVersion: 1,
      desktopApps: [
        { appId: "code.exe", processName: "Code.exe", category: "waste" },
      ],
    });

    await user.click(screen.getByRole("button", { name: "削除" }));
    await screen.findByText("アプリ分類を削除しました。");
    expect(screen.getByText("まだ分類済みのアプリはありません。")).toBeInTheDocument();
  });

  it("shows validation and save errors", async () => {
    const user = userEvent.setup();
    const repository = createRepository();
    repository.save.mockRejectedValueOnce(new Error("store failure"));
    render(
      <AppCategorySettingsSection
        repository={repository}
        hourlyRateRepository={createHourlyRateRepository()}
      />,
    );

    await screen.findByText("まだ分類済みのアプリはありません。");
    await user.click(screen.getByRole("button", { name: "追加・更新" }));
    expect(screen.getByRole("alert")).toHaveTextContent("登録済みのアプリを選択してください。");

    await user.selectOptions(
      screen.getByLabelText("分類する登録済みアプリ"),
      "code.exe",
    );
    await user.click(screen.getByRole("button", { name: "追加・更新" }));
    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("分類設定を保存できませんでした。"),
    );
  });
});
