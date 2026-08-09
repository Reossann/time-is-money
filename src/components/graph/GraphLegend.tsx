import type { GraphMetric } from "../../types/graph";

import { GRAPH_METRIC_LABELS } from "./graphDisplayUtils";

type GraphLegendProps = Readonly<{
  metric: GraphMetric;
}>;

export function GraphLegend({ metric }: GraphLegendProps) {
  return (
    <p className="graph-legend" aria-label="グラフの凡例">
      表示中: {GRAPH_METRIC_LABELS[metric]}
    </p>
  );
}
