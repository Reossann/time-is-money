import { useEffect, useState } from "react";

import type { GraphData } from "../../types/graph";

import {
  formatGraphMetricValue,
  getGraphMetricValue,
} from "./graphDisplayUtils";

const CHART_WIDTH = 800;
const CHART_HEIGHT = 320;
const PADDING = {
  top: 24,
  right: 24,
  bottom: 52,
  left: 82,
};

type TrendChartProps = Readonly<{
  data: GraphData;
}>;

function createChartCoordinates(data: GraphData): ReadonlyArray<{
  x: number;
  y: number;
}> {
  const values = data.points.map((point) =>
    getGraphMetricValue(point, data.metric),
  );
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  return values.map((value, index) => {
    const x =
      PADDING.left +
      (values.length === 1
        ? innerWidth / 2
        : (index / (values.length - 1)) * innerWidth);
    const y = PADDING.top + ((maximum - value) / range) * innerHeight;
    return { x, y };
  });
}

function createYAxisTicks(
  data: GraphData,
): ReadonlyArray<{ value: number; y: number }> {
  const values = data.points.map((point) =>
    getGraphMetricValue(point, data.metric),
  );
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = maximum - minimum || 1;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const tickCount = 5;

  return Array.from({ length: tickCount }, (_, index) => {
    const ratio = index / (tickCount - 1);
    return {
      value: maximum - range * ratio,
      y: PADDING.top + ratio * innerHeight,
    };
  });
}

export function TrendChart({ data }: TrendChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    setSelectedIndex(null);
  }, [data]);

  if (data.points.length === 0) {
    return <p>この期間のデータはありません。</p>;
  }

  const coordinates = createChartCoordinates(data);
  const points = coordinates.map(({ x, y }) => `${x},${y}`).join(" ");
  const yTicks = createYAxisTicks(data);
  const label = `${data.points.length}件の${data.metric}推移グラフ`;
  const selectedPoint =
    selectedIndex === null ? null : data.points[selectedIndex] ?? null;

  const selectPoint = (index: number) => {
    if (index < 0 || index >= data.points.length) {
      setSelectedIndex(null);
      return;
    }
    setSelectedIndex(index);
  };

  return (
    <div className="trend-chart-wrapper">
      <svg
        className="trend-chart"
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        role="img"
        aria-label={label}
      >
        {yTicks.map((tick) => (
          <g key={`y-${tick.y}`}>
            <line
              x1={PADDING.left}
              y1={tick.y}
              x2={CHART_WIDTH - PADDING.right}
              y2={tick.y}
              className="trend-chart__grid-line"
            />
            <text
              x={PADDING.left - 10}
              y={tick.y + 4}
              className="trend-chart__tick-label trend-chart__tick-label--y"
            >
              {formatGraphMetricValue(tick.value, data.metric)}
            </text>
          </g>
        ))}
        <line
          x1={PADDING.left}
          y1={CHART_HEIGHT - PADDING.bottom}
          x2={CHART_WIDTH - PADDING.right}
          y2={CHART_HEIGHT - PADDING.bottom}
          className="trend-chart__axis"
        />
        <polyline points={points} className="trend-chart__line" />
        {data.points.map((point, index) => {
          const coordinate = coordinates[index];
          if (coordinate === undefined) return null;

          return (
            <text
              key={`x-${point.dateKey}`}
              x={coordinate.x}
              y={CHART_HEIGHT - PADDING.bottom + 24}
              className="trend-chart__tick-label trend-chart__tick-label--x"
            >
              {point.label}
            </text>
          );
        })}
        {data.points.map((point, index) => {
          const coordinate = coordinates[index];
          if (coordinate === undefined) return null;

          const pointLabel = `${point.label}: ${formatGraphMetricValue(
            getGraphMetricValue(point, data.metric),
            data.metric,
          )}`;

          return (
            <circle
              key={point.dateKey}
              cx={coordinate.x}
              cy={coordinate.y}
              r={index === selectedIndex ? 7 : 5}
              className={
                index === selectedIndex
                  ? "trend-chart__point trend-chart__point--selected"
                  : "trend-chart__point"
              }
              role="button"
              tabIndex={0}
              aria-label={pointLabel}
              aria-pressed={index === selectedIndex}
              onClick={() => selectPoint(index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  selectPoint(index);
                }
              }}
            />
          );
        })}
      </svg>
      {selectedPoint !== null ? (
        <p className="trend-chart__selection" role="status">
          選択中: {selectedPoint.label} / {formatGraphMetricValue(
            getGraphMetricValue(selectedPoint, data.metric),
            data.metric,
          )}
        </p>
      ) : null}
    </div>
  );
}
