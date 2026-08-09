import type { GraphMetric } from "../../types/graph";

const METRIC_OPTIONS: ReadonlyArray<{
  value: GraphMetric;
  label: string;
}> = [
  { value: "usageSeconds", label: "利用時間" },
  { value: "earnedYen", label: "獲得額" },
  { value: "wastedYen", label: "浪費額" },
  { value: "netYen", label: "純増減" },
];

type GraphMetricControlsProps = Readonly<{
  value: GraphMetric;
  onChange: (metric: GraphMetric) => void;
}>;

export function GraphMetricControls({
  value,
  onChange,
}: GraphMetricControlsProps) {
  return (
    <div className="graph-metric-controls" role="group" aria-label="表示指標">
      {METRIC_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            option.value === value
              ? "graph-metric-controls__button graph-metric-controls__button--active"
              : "graph-metric-controls__button"
          }
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
