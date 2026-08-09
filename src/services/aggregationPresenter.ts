import type { PeriodAggregate } from "../types/aggregation";
import type { GraphData, GraphMetric, GraphPeriod } from "../types/graph";

export type CalendarPeriodSummary = Readonly<{
  key: string;
  label: string;
  sessionCount: number;
  durationSeconds: number;
  durationText: string;
  earnedYen: number;
  wastedYen: number;
  netYen: number;
  earnedText: string;
  wastedText: string;
  netText: string;
}>;

function labelForPeriod(key: string): string {
  return key.replaceAll("-", "/");
}

export function formatDurationSeconds(durationSeconds: number): string {
  const hours = Math.floor(durationSeconds / 3_600);
  const minutes = Math.floor((durationSeconds % 3_600) / 60);
  const seconds = durationSeconds % 60;
  return `${hours}:${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
}

export function formatYen(amount: number): string {
  return new Intl.NumberFormat("ja-JP", {
    style: "currency",
    currency: "JPY",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function presentCalendarPeriodSummaries(
  aggregates: readonly PeriodAggregate[],
): readonly CalendarPeriodSummary[] {
  return Object.freeze(
    aggregates.map((aggregate) =>
      Object.freeze({
        key: aggregate.period.key,
        label: labelForPeriod(aggregate.period.key),
        sessionCount: aggregate.sessionCount,
        durationSeconds: aggregate.durationSeconds,
        durationText: formatDurationSeconds(aggregate.durationSeconds),
        earnedYen: aggregate.earnedYen,
        wastedYen: aggregate.wastedYen,
        netYen: aggregate.netYen,
        earnedText: formatYen(aggregate.earnedYen),
        wastedText: formatYen(aggregate.wastedYen),
        netText: formatYen(aggregate.netYen),
      }),
    ),
  );
}

/** Maps the shared aggregate contract to #41's existing graph view model. */
export function presentGraphData(
  aggregates: readonly PeriodAggregate[],
  period: GraphPeriod,
  metric: GraphMetric,
): GraphData {
  return Object.freeze({
    period,
    metric,
    points: Object.freeze(
      aggregates.map((aggregate) =>
        Object.freeze({
          dateKey: aggregate.period.key,
          label: labelForPeriod(aggregate.period.key),
          usageSeconds: aggregate.durationSeconds,
          earnedYen: aggregate.earnedYen,
          wastedYen: aggregate.wastedYen,
          netYen: aggregate.netYen,
        }),
      ),
    ),
  });
}
