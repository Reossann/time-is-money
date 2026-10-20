import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getPeriodAggregates } = vi.hoisted(() => ({ getPeriodAggregates: vi.fn() }));
vi.mock("../services/aggregationClient", () => ({ aggregationClient: { getPeriodAggregates } }));
vi.mock("../services/ownerIdentityService", () => ({ ownerIdentityService: { getCurrentOwnerId: vi.fn(async () => "owner-1") } }));

import type { PeriodAggregate } from "../types/aggregation";
import { CalendarPage } from "./CalendarPage";

function aggregate(key: string, values: Partial<PeriodAggregate> = {}): PeriodAggregate {
  return {
    period: { granularity: "day", key, startAt: "2026-08-01T00:00:00.000Z", endAt: "2026-08-02T00:00:00.000Z", timeZoneId: "UTC" },
    sessionCount: 1,
    durationSeconds: 7_200,
    trackedDurationSeconds: 7_200,
    untrackedDurationSeconds: 0,
    earnedYen: 1_000,
    wastedYen: 200,
    netYen: 800,
    ...values,
  };
}

describe("CalendarPage", () => {
  beforeEach(() => {
    getPeriodAggregates.mockReset().mockResolvedValue([
      aggregate("2026-08-01"),
      aggregate("2026-08-09", { netYen: -500, wastedYen: 1_000 }),
    ]);
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-09T12:00:00+09:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders persisted daily aggregates and selected-day details", async () => {
    render(<CalendarPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "2026年 8月" })).toBeInTheDocument());
    expect(screen.getByLabelText(/8月9日、利用時間2時間/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "2時間" })).toBeInTheDocument();
  });

  it("moves to another month and requests a new range", async () => {
    render(<CalendarPage />);
    await waitFor(() => expect(getPeriodAggregates).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "翌月" }));
    expect(await screen.findByRole("heading", { name: "2026年 9月" })).toBeInTheDocument();
    await waitFor(() => expect(getPeriodAggregates.mock.calls.length).toBeGreaterThanOrEqual(2));
  });

  it("shows an empty selected day without stale details", async () => {
    render(<CalendarPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "2026年 8月" })).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText("8月2日、記録なし"));
    expect(screen.getByRole("heading", { name: "記録なし" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "2時間" })).not.toBeInTheDocument();
  });

  it("shows an error and retries the request", async () => {
    getPeriodAggregates.mockReset().mockRejectedValue(new Error("failed"));
    render(<CalendarPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("取得できませんでした"));
    fireEvent.click(screen.getByRole("button", { name: "再試行" }));
    await waitFor(() => expect(getPeriodAggregates.mock.calls.length).toBeGreaterThanOrEqual(2));
  });
});
