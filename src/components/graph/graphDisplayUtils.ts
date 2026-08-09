import type { GraphMetric, GraphPoint } from "../../types/graph";

export const GRAPH_METRIC_LABELS: Readonly<Record<GraphMetric, string>> = {
  usageSeconds: "利用時間",
  earnedYen: "獲得額",
  wastedYen: "浪費額",
  netYen: "純増減",
};

export function getGraphMetricValue(
  point: GraphPoint,
  metric: GraphMetric,
): number {
  return point[metric];
}

export function formatGraphMetricValue(
  value: number,
  metric: GraphMetric,
): string {
  if (metric === "usageSeconds") {
    const wholeSeconds = Math.max(0, Math.floor(value));
    const hours = Math.floor(wholeSeconds / 3_600);
    const minutes = Math.floor((wholeSeconds % 3_600) / 60);
    const seconds = wholeSeconds % 60;
    return [hours, minutes, seconds]
      .map((part) => String(part).padStart(2, "0"))
      .join(":");
  }

  return `${new Intl.NumberFormat("ja-JP").format(value)}円`;
}
