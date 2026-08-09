import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { AggregationClient } from "../services/aggregationClient";
import {
  AggregationError,
  type AggregationQuery,
  type PeriodAggregate,
} from "../types/aggregation";
import { usePeriodAggregates } from "./usePeriodAggregates";

const query: AggregationQuery = {
  ownerId: "owner-a",
  granularity: "day",
  from: "2026-08-01T00:00:00.000Z",
  to: "2026-08-02T00:00:00.000Z",
  timeZoneId: "UTC",
};

const aggregate = {
  period: {
    granularity: "day" as const,
    key: "2026-08-01",
    startAt: query.from,
    endAt: query.to,
    timeZoneId: "UTC",
  },
  sessionCount: 1,
  durationSeconds: 60,
  trackedDurationSeconds: 60,
  untrackedDurationSeconds: 0,
  earnedYen: 1,
  wastedYen: 0,
  netYen: 1,
};

function Harness({ client, currentQuery }: { client: AggregationClient; currentQuery: AggregationQuery }) {
  const state = usePeriodAggregates({ client, query: currentQuery });
  return (
    <div>
      <span data-testid="status">{state.status}</span>
      <span data-testid="key">{state.data?.[0]?.period.key ?? ""}</span>
      <span data-testid="error">{state.errorMessage ?? ""}</span>
      <button type="button" onClick={state.retry}>再試行</button>
    </div>
  );
}

describe("usePeriodAggregates", () => {
  it("loads, retries, and reports a safe limit error", async () => {
    const client: AggregationClient = {
      getPeriodAggregates: vi
        .fn()
        .mockRejectedValueOnce(new AggregationError("QUERY_LIMIT_EXCEEDED", "private"))
        .mockResolvedValueOnce([aggregate]),
    };
    render(<Harness client={client} currentQuery={query} />);
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("error"));
    expect(screen.getByTestId("error")).toHaveTextContent("上限");
    screen.getByRole("button", { name: "再試行" }).click();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("success"));
  });

  it("discards an older owner request after the owner changes", async () => {
    let resolveFirst: ((value: readonly PeriodAggregate[]) => void) | undefined;
    const client: AggregationClient = {
      getPeriodAggregates: (input: AggregationQuery): Promise<readonly PeriodAggregate[]> => {
        if (input.ownerId === "owner-a") {
          return new Promise<readonly PeriodAggregate[]>((resolve) => {
            resolveFirst = resolve;
          });
        }
        return Promise.resolve([{ ...aggregate, period: { ...aggregate.period, key: "2026-08-02" } }]);
      },
    };
    const rendered = render(<Harness client={client} currentQuery={query} />);
    rendered.rerender(<Harness client={client} currentQuery={{ ...query, ownerId: "owner-b" }} />);
    await waitFor(() => expect(screen.getByTestId("key")).toHaveTextContent("2026-08-02"));
    resolveFirst?.([aggregate]);
    await waitFor(() => expect(screen.getByTestId("key")).toHaveTextContent("2026-08-02"));
  });
});
