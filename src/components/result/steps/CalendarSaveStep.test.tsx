import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  saveOnce: vi.fn(async () => {}),
  retrySave: vi.fn(async () => {}),
  removeSaved: vi.fn(async () => {}),
}));

vi.mock("../../../services/sessionRecordPersistenceController", () => ({
  saveFinalizedSessionRecordOnce: mocks.saveOnce,
  retrySaveFinalizedSessionRecord: mocks.retrySave,
  removeSavedSessionRecord: mocks.removeSaved,
}));

import { useSessionRecordSaveStore } from "../../../stores/useSessionRecordSaveStore";
import type { ResultFlowPreviewContent } from "../../../types/resultFlow";
import { CalendarSaveStep } from "./CalendarSaveStep";

const content: ResultFlowPreviewContent = {
  title: "カレンダーへ保存",
  description: "計測結果をカレンダー用に保存します。",
  responsibleIssue: "#35",
};

describe("CalendarSaveStep", () => {
  beforeEach(() => {
    useSessionRecordSaveStore.getState().reset();
    mocks.saveOnce.mockClear();
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
  });
});
