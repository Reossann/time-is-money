import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getPeriodAggregates } = vi.hoisted(() => ({ getPeriodAggregates: vi.fn() }));
vi.mock("../services/aggregationClient", () => ({ aggregationClient: { getPeriodAggregates } }));
vi.mock("../services/ownerIdentityService", () => ({ ownerIdentityService: { getCurrentOwnerId: vi.fn(async () => "owner-1") } }));

import { CalendarPage } from "./CalendarPage";

describe("CalendarPage net amount", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-09T12:00:00+09:00"));
    getPeriodAggregates.mockReset().mockResolvedValue([{
      period: { granularity: "day", key: "2026-08-09", startAt: "2026-08-08T15:00:00.000Z", endAt: "2026-08-09T15:00:00.000Z", timeZoneId: "Asia/Tokyo" },
      sessionCount: 1,
      durationSeconds: 60,
      trackedDurationSeconds: 60,
      untrackedDurationSeconds: 0,
      earnedYen: 0,
      wastedYen: 1_000,
      netYen: -1_000,
    }]);
  });

  it("shows a negative net amount without a contradictory plus sign", async () => {
    render(<CalendarPage />);
    await waitFor(() => expect(screen.getByRole("heading", { name: "2026年 8月" })).toBeInTheDocument());
    expect(screen.getAllByText("-￥1,000").length).toBeGreaterThan(0);
    expect(screen.queryByText("+￥-1,000")).not.toBeInTheDocument();
  });
});
