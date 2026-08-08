import type { GraphData } from "../../types/graph";

import {
  formatGraphMetricValue,
  getGraphMetricValue,
} from "./graphDisplayUtils";

type GraphTableProps = Readonly<{
  data: GraphData;
}>;

export function GraphTable({ data }: GraphTableProps) {
  return (
    <table className="graph-table">
      <caption>グラフデータの一覧</caption>
      <thead>
        <tr>
          <th scope="col">項目</th>
          {data.points.map((point) => (
            <th key={point.dateKey} scope="col">
              {point.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        <tr>
          <th scope="row">値</th>
          {data.points.map((point) => (
            <td key={point.dateKey}>
              {formatGraphMetricValue(
                getGraphMetricValue(point, data.metric),
                data.metric,
              )}
            </td>
          ))}
        </tr>
      </tbody>
    </table>
  );
}
