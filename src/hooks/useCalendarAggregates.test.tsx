import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AggregationClient } from "../services/aggregationClient";
import type { PeriodAggregate } from "../types/aggregation";
import { useCalendarAggregates } from "./useCalendarAggregates";

const aggregate: PeriodAggregate = {
  period: {
    granularity: "day",
    key: "2026-08-01",
    startAt: "2026-07-31T15:00:00.000Z",
    endAt: "2026-08-01T15:00:00.000Z",
    timeZoneId: "Asia/Tokyo",
  },
  sessionCount: 1,
  durationSeconds: 60,
  trackedDurationSeconds: 60,
  untrackedDurationSeconds: 0,
  earnedYen: 100,
  wastedYen: 0,
  netYen: 100,
};

function Harness({ client, month }: { client: AggregationClient; month: number }) {
  const state = useCalendarAggregates({
    client,
    ownerId: "owner-1",
    year: 2026,
    month,
    timeZoneId: "Asia/Tokyo",
  });
  return <><span data-testid="status">{state.status}</span><span data-testid="from">{state.query.from}</span></>;
}

describe("useCalendarAggregates", () => {
  it("requests the complete local calendar month with empty periods", async () => {
    const client: AggregationClient = {
      getPeriodAggregates: vi.fn().mockResolvedValue([aggregate]),
    };
    render(<Harness client={client} month={8} />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("success"));
    expect(client.getPeriodAggregates).toHaveBeenCalledWith({
      ownerId: "owner-1",
      granularity: "day",
      from: "2026-07-31T15:00:00.000Z",
      to: "2026-08-31T15:00:00.000Z",
      timeZoneId: "Asia/Tokyo",
      includeEmptyPeriods: true,
    });
  });

  it("reloads when the displayed month changes", async () => {
    const client: AggregationClient = {
      getPeriodAggregates: vi.fn().mockResolvedValue([]),
    };
    const view = render(<Harness client={client} month={8} />);
    await waitFor(() => expect(client.getPeriodAggregates).toHaveBeenCalledTimes(1));
    view.rerender(<Harness client={client} month={9} />);
    await waitFor(() => expect(client.getPeriodAggregates).toHaveBeenCalledTimes(2));
    expect(client.getPeriodAggregates).toHaveBeenLastCalledWith(expect.objectContaining({
      from: "2026-08-31T15:00:00.000Z",
      to: "2026-09-30T15:00:00.000Z",
    }));
  });
});
