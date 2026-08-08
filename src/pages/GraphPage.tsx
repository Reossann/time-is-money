import { useState } from "react";

import { GraphLegend } from "../components/graph/GraphLegend";
import { GraphMetricControls } from "../components/graph/GraphMetricControls";
import { GraphPeriodControls } from "../components/graph/GraphPeriodControls";
import { GraphTable } from "../components/graph/GraphTable";
import { TrendChart } from "../components/graph/TrendChart";
import { useGraphData } from "../hooks/useGraphData";
import { demoGraphQueryService } from "../services/graphDemoData";
import {
  unavailableGraphQueryService,
} from "../services/graphDataSource";
import type { GraphQueryService } from "../services/graphQueryService";
import type { GraphMetric, GraphPeriod } from "../types/graph";

const PERIOD_LABELS: Readonly<Record<GraphPeriod, string>> = {
  day: "日",
  week: "週",
  month: "月",
};

const METRIC_LABELS: Readonly<Record<GraphMetric, string>> = {
  usageSeconds: "利用時間",
  earnedYen: "獲得額",
  wastedYen: "浪費額",
  netYen: "純増減",
};

type GraphPageProps = Readonly<{
  accountId?: string;
  graphService?: GraphQueryService;
}>;

export function GraphPage({ accountId, graphService }: GraphPageProps = {}) {
  const [period, setPeriod] = useState<GraphPeriod>("day");
  const [metric, setMetric] = useState<GraphMetric>("usageSeconds");
  const isDemo = graphService === undefined && import.meta.env.DEV;
  const service = graphService ??
    (isDemo ? demoGraphQueryService : unavailableGraphQueryService);
  const graphState = useGraphData({
    service,
    params: {
      accountId: accountId ?? "local-account",
      period,
      metric,
    },
  });

  return (
    <main className="page">
      <h2>グラフ</h2>
      <GraphPeriodControls value={period} onChange={setPeriod} />
      <GraphMetricControls value={metric} onChange={setMetric} />
      {isDemo ? <p className="graph-demo-notice">開発用デモデータ</p> : null}
      <p role="status">表示期間: {PERIOD_LABELS[period]}</p>
      <p role="status">表示指標: {METRIC_LABELS[metric]}</p>
      {graphState.status === "loading" ? (
        <p>グラフを読み込んでいます。</p>
      ) : graphState.status === "empty" ? (
        <p>この期間のデータはありません。</p>
      ) : graphState.status === "error" ? (
        <div className="error-section" role="alert">
          <p>{graphState.errorMessage}</p>
          <button type="button" onClick={graphState.retry}>
            再試行
          </button>
        </div>
      ) : graphState.status === "success" && graphState.data !== null ? (
        <section className="graph-section" aria-label="グラフ表示">
          <GraphLegend metric={graphState.data.metric} />
          <TrendChart data={graphState.data} />
          <GraphTable data={graphState.data} />
        </section>
      ) : (
        <p>グラフデータを取得すると、ここに推移を表示します。</p>
      )}
    </main>
  );
}
