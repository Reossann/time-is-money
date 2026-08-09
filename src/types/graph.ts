export type GraphPeriod = "day" | "week" | "month";

export type GraphMetric =
  | "usageSeconds"
  | "earnedYen"
  | "wastedYen"
  | "netYen";

export type GraphPoint = Readonly<{
  dateKey: string;
  label: string;
  usageSeconds: number;
  earnedYen: number;
  wastedYen: number;
  netYen: number;
}>;

export type GraphData = Readonly<{
  period: GraphPeriod;
  metric: GraphMetric;
  points: ReadonlyArray<GraphPoint>;
}>;
