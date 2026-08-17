import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveOnce: vi.fn(async () => {}),
  retrySave: vi.fn(async () => {}),
  removeSaved: vi.fn(async () => {}),
  getSaved: vi.fn<() => import("../../../types/sessionRecord").SessionRecord | null>(() => null),
}));

vi.mock("../../../services/sessionRecordPersistenceController", () => ({
  saveFinalizedSessionRecordOnce: mocks.saveOnce,
  retrySaveFinalizedSessionRecord: mocks.retrySave,
  removeSavedSessionRecord: mocks.removeSaved,
  getSavedSessionRecord: mocks.getSaved,
}));

import { buildSessionRecord } from "../../../services/sessionRecordService";
import { useSessionRecordSaveStore } from "../../../stores/useSessionRecordSaveStore";
import { validSessionResult } from "../../../test/fixtures/sessionResult";
import type { ResultFlowPreviewContent } from "../../../types/resultFlow";
import { CalendarSaveStep } from "./CalendarSaveStep";

const content: ResultFlowPreviewContent = {
  title: "カレンダーへ保存",
  description: "計測結果をカレンダー用に保存します。",
  responsibleIssue: "#35",
};

const savedRecord = buildSessionRecord({
  result: validSessionResult,
  ownerId: "owner-1",
  now: 50_000,
});

describe("CalendarSaveStep", () => {
  beforeEach(() => {
    useSessionRecordSaveStore.getState().reset();
    mocks.saveOnce.mockClear();
    mocks.getSaved.mockReset().mockReturnValue(null);
  });

  afterEach(() => {
    useSessionRecordSaveStore.getState().reset();
  });

  it("renders the placeholder and does not save in preview", () => {
    render(
      <CalendarSaveStep
        content={content}
        status="placeholder"
        animationSkipped={false}
      />,
    );

    expect(screen.getByText("準備中")).toBeInTheDocument();
    expect(
      screen.getByText(/実際の金額・保存結果・設定変更は行いません/),
    ).toBeInTheDocument();
    expect(mocks.saveOnce).not.toHaveBeenCalled();
  });

  it("triggers the save and renders the save panel when connected", () => {
    render(
      <CalendarSaveStep
        content={content}
        status="ready"
        animationSkipped={false}
      />,
    );

    expect(mocks.saveOnce).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("heading", { name: "カレンダーへ保存" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "保存の準備をしています",
    );
    expect(screen.queryByRole("heading", { name: "カレンダー" })).not.toBeInTheDocument();
  });

  it.each(["saving", "failed"] as const)(
    "does not render the preview while the save status is %s",
    (status) => {
      mocks.getSaved.mockReturnValue(savedRecord);
      render(
        <CalendarSaveStep
          content={content}
          status="ready"
          animationSkipped={false}
        />,
      );

      if (status === "saving") {
        act(() => useSessionRecordSaveStore.getState().markSaving());
      } else {
        act(() => useSessionRecordSaveStore.getState().markFailed("SAVE_FAILED"));
      }

      expect(screen.queryByRole("heading", { name: "カレンダー" })).not.toBeInTheDocument();
    },
  );

  it("renders the saved record preview after a successful save", () => {
    mocks.getSaved.mockReturnValue(savedRecord);
    render(
      <CalendarSaveStep
        content={content}
        status="ready"
        animationSkipped={false}
      />,
    );

    act(() => useSessionRecordSaveStore.getState().markSaved(savedRecord.sessionId));

    expect(screen.getByRole("heading", { name: "カレンダー" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(
      "計測結果をカレンダーへ保存しました。",
    );
    expect(screen.getByText("Code.exe")).toBeInTheDocument();
  });

  it("renders the development preview while the step is still a placeholder", () => {
    render(
      <CalendarSaveStep
        content={content}
        status="placeholder"
        animationSkipped={false}
        previewRecord={savedRecord}
      />,
    );

    expect(screen.getByRole("heading", { name: "カレンダー" })).toBeInTheDocument();
    expect(screen.getByText("Code.exe")).toBeInTheDocument();
  });

  it("hides the preview after the saved record is reset", () => {
    mocks.getSaved.mockReturnValue(savedRecord);
    render(
      <CalendarSaveStep
        content={content}
        status="ready"
        animationSkipped={false}
      />,
    );

    act(() => useSessionRecordSaveStore.getState().markSaved(savedRecord.sessionId));
    expect(screen.getByRole("heading", { name: "カレンダー" })).toBeInTheDocument();

    mocks.getSaved.mockReturnValue(null);
    act(() => useSessionRecordSaveStore.getState().reset());
    expect(screen.queryByRole("heading", { name: "カレンダー" })).not.toBeInTheDocument();
  });
});
