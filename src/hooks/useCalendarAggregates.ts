import { useMemo } from "react";

import { aggregationClient, type AggregationClient } from "../services/aggregationClient";
import { addCalendarMonths, calendarDateStartToUtc } from "../utils/calendarMath";
import { usePeriodAggregates, type PeriodAggregatesState } from "./usePeriodAggregates";

export type UseCalendarAggregatesOptions = Readonly<{
  ownerId: string;
  year: number;
  month: number;
  timeZoneId?: string;
  client?: AggregationClient;
}>;

export type CalendarAggregatesState = PeriodAggregatesState & Readonly<{
  query: Readonly<{
    ownerId: string;
    granularity: "day";
    from: string;
    to: string;
    timeZoneId: string;
    includeEmptyPeriods: true;
  }>;
}>;

function getDefaultTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function useCalendarAggregates({
  ownerId,
  year,
  month,
  timeZoneId = getDefaultTimeZone(),
  client = aggregationClient,
}: UseCalendarAggregatesOptions): CalendarAggregatesState {
  const query = useMemo(() => {
    const start = { year, month, day: 1 } as const;
    const end = addCalendarMonths(start, 1);
    return {
      ownerId,
      granularity: "day" as const,
      from: new Date(calendarDateStartToUtc(start, timeZoneId)).toISOString(),
      to: new Date(calendarDateStartToUtc(end, timeZoneId)).toISOString(),
      timeZoneId,
      includeEmptyPeriods: true as const,
    };
  }, [ownerId, year, month, timeZoneId]);

  const state = usePeriodAggregates({ client, query });
  return { ...state, query };
}
