import { useState } from "react";

import { GraphLegend } from "../components/graph/GraphLegend";
import { GraphMetricControls } from "../components/graph/GraphMetricControls";
import { GraphPeriodControls } from "../components/graph/GraphPeriodControls";
import { GraphTable } from "../components/graph/GraphTable";
import { TrendChart } from "../components/graph/TrendChart";
import { useGraphData } from "../hooks/useGraphData";
import { demoGraphQueryService } from "../services/graphDemoData";
import type {
  GraphQueryParams,
  GraphQueryService,
} from "../services/graphQueryService";
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

type GraphDataSectionProps = Readonly<{
  service: GraphQueryService;
  params: GraphQueryParams;
}>;

function GraphDataSection({ service, params }: GraphDataSectionProps) {
  const graphState = useGraphData({ service, params });

  if (graphState.status === "loading") {
    return <p>グラフを読み込んでいます。</p>;
  }

  if (graphState.status === "empty") {
    return <p>この期間のデータはありません。</p>;
  }

  if (graphState.status === "error") {
    return (
      <div className="error-section" role="alert">
        <p>{graphState.errorMessage}</p>
        <button type="button" onClick={graphState.retry}>
          再試行
        </button>
      </div>
    );
  }

  if (graphState.status === "success" && graphState.data !== null) {
    return (
      <section className="graph-section" aria-label="グラフ表示">
        <GraphLegend metric={graphState.data.metric} />
        <TrendChart data={graphState.data} />
        <GraphTable data={graphState.data} />
      </section>
    );
  }

  return <p>グラフデータを取得すると、ここに推移を表示します。</p>;
}

export function GraphPage({ accountId, graphService }: GraphPageProps = {}) {
  const [period, setPeriod] = useState<GraphPeriod>("day");
  const [metric, setMetric] = useState<GraphMetric>("usageSeconds");
  const isDemo = graphService === undefined && import.meta.env.DEV;
  const service = graphService ?? (isDemo ? demoGraphQueryService : null);
  const params: GraphQueryParams = {
    accountId: accountId ?? "local-account",
    period,
    metric,
  };

  return (
    <main className="page graph-page">
      <h2>グラフ</h2>
      <div className="graph-toolbar">
        <div className="graph-toolbar__controls">
          <GraphPeriodControls value={period} onChange={setPeriod} />
          <GraphMetricControls value={metric} onChange={setMetric} />
        </div>
        <div className="graph-toolbar__summary">
          {isDemo ? <p className="graph-demo-notice">開発用デモデータ</p> : null}
          <p role="status">表示期間: {PERIOD_LABELS[period]}</p>
          <p role="status">表示指標: {METRIC_LABELS[metric]}</p>
        </div>
      </div>
      {service === null ? (
        <p>グラフデータ連携は準備中です。</p>
      ) : (
        <GraphDataSection service={service} params={params} />
      )}
    </main>
  );
}
