import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { buildSessionRecord } from "../../../services/sessionRecordService";
import { validSessionResult } from "../../../test/fixtures/sessionResult";
import { CalendarPreview } from "./CalendarPreview";

const record = buildSessionRecord({
  result: {
    ...validSessionResult,
    startedAt: Date.parse("2026-08-09T00:00:00.000Z"),
    endedAt: Date.parse("2026-08-09T02:10:00.000Z"),
    durationSeconds: 7_800,
    trackedDurationSeconds: 7_800,
    untrackedDurationSeconds: 0,
    apps: validSessionResult.apps.map((app, index) => ({
      ...app,
      durationSeconds: index === 0 ? 5_400 : 2_400,
      money: index === 0
        ? { earnedYen: 4_500, wastedYen: 500, netYen: 4_000 }
        : { earnedYen: 2_000, wastedYen: 500, netYen: 1_500 },
    })),
    totals: { earnedYen: 6_500, wastedYen: 1_000, netYen: 5_500 },
  },
  ownerId: "owner-1",
  now: 50_000,
});

describe("CalendarPreview", () => {
  it("shows the saved day with its persisted totals and app breakdown", () => {
    render(<CalendarPreview record={record} />);

    expect(screen.getByRole("heading", { name: "カレンダー" })).toBeInTheDocument();
    expect(screen.getByText("2026年 8月")).toBeInTheDocument();
    expect(screen.getAllByText("2時間10分")).toHaveLength(3);
    expect(screen.getAllByText("+6,500円")).toHaveLength(3);
    expect(screen.getAllByText("−1,000円")).toHaveLength(3);
    expect(screen.getByText("Code.exe")).toBeInTheDocument();
  });

  it("keeps non-saved cells free of session metrics", () => {
    render(<CalendarPreview record={record} />);

    const selectedCell = screen.getByText("9").closest("div");
    expect(selectedCell).toHaveClass("calendar-preview__cell--selected");
    expect(screen.getAllByText("2時間10分")).toHaveLength(3);
    expect(document.querySelectorAll(".calendar-preview__cell-values")).toHaveLength(1);
  });

  it("shows only the empty state when the selected date has no records", () => {
    render(
      <CalendarPreview
        record={record}
        records={[record]}
        currentDateKey="2026-08-10"
      />,
    );

    const detail = screen.getByLabelText("8月10日の記録");
    expect(detail).toHaveTextContent("この日の記録はありません。");
    expect(within(detail).queryByText("Code.exe")).not.toBeInTheDocument();
    expect(within(detail).queryByText("アプリ別の内訳")).not.toBeInTheDocument();
  });

  it("aggregates multiple sessions on the same day", () => {
    const secondRecord = {
      ...record,
      sessionId: "session-2",
      durationSeconds: 600,
      trackedDurationSeconds: 600,
      totals: { earnedYen: 100, wastedYen: 50, netYen: 50 },
      apps: record.apps.map((app, index) => ({
        ...app,
        durationSeconds: index === 0 ? 600 : 0,
      })),
    };

    render(<CalendarPreview record={record} records={[record, secondRecord]} />);

    const detail = screen.getByLabelText("8月9日の記録");
    expect(within(detail).getByText("2時間20分")).toBeInTheDocument();
    expect(within(detail).getByText("+6,600円")).toBeInTheDocument();
    expect(within(detail).getByText("−1,050円")).toBeInTheDocument();
  });
});
