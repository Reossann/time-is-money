import type { GraphPeriod } from "../../types/graph";

const PERIOD_OPTIONS: ReadonlyArray<{
  value: GraphPeriod;
  label: string;
}> = [
  { value: "day", label: "日" },
  { value: "week", label: "週" },
  { value: "month", label: "月" },
];

type GraphPeriodControlsProps = Readonly<{
  value: GraphPeriod;
  onChange: (period: GraphPeriod) => void;
}>;

export function GraphPeriodControls({
  value,
  onChange,
}: GraphPeriodControlsProps) {
  return (
    <div className="graph-period-controls" role="group" aria-label="表示期間">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          className={
            option.value === value
              ? "graph-period-controls__button graph-period-controls__button--active"
              : "graph-period-controls__button"
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
