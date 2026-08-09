import type {
  GraphData,
  GraphMetric,
  GraphPeriod,
  GraphPoint,
} from "../types/graph";
import type {
  GraphQueryParams,
  GraphQueryService,
} from "./graphQueryService";

/**
 * TEMP: グラフの見た目を確認するための開発用データ。
 * #7/#12/#13接続時に、このファイルとGraphPageのdemo分岐を削除する。
 */
const DEMO_POINTS: Readonly<Record<GraphPeriod, ReadonlyArray<GraphPoint>>> = {
  day: [
    { dateKey: "2026-08-03", label: "8/3", usageSeconds: 7_200, earnedYen: 6_000, wastedYen: 500, netYen: 5_500 },
    { dateKey: "2026-08-04", label: "8/4", usageSeconds: 10_800, earnedYen: 8_000, wastedYen: 2_000, netYen: 6_000 },
    { dateKey: "2026-08-05", label: "8/5", usageSeconds: 5_400, earnedYen: 4_500, wastedYen: 1_500, netYen: 3_000 },
    { dateKey: "2026-08-06", label: "8/6", usageSeconds: 14_400, earnedYen: 10_000, wastedYen: 1_000, netYen: 9_000 },
    { dateKey: "2026-08-07", label: "8/7", usageSeconds: 9_000, earnedYen: 7_000, wastedYen: 3_000, netYen: 4_000 },
    { dateKey: "2026-08-08", label: "8/8", usageSeconds: 3_600, earnedYen: 2_500, wastedYen: 2_000, netYen: 500 },
    { dateKey: "2026-08-09", label: "今日", usageSeconds: 7_800, earnedYen: 6_500, wastedYen: 1_000, netYen: 5_500 },
  ],
  week: [
    { dateKey: "2026-W27", label: "7/6週", usageSeconds: 36_000, earnedYen: 27_000, wastedYen: 8_000, netYen: 19_000 },
    { dateKey: "2026-W28", label: "7/13週", usageSeconds: 43_200, earnedYen: 34_000, wastedYen: 7_000, netYen: 27_000 },
    { dateKey: "2026-W29", label: "7/20週", usageSeconds: 28_800, earnedYen: 22_000, wastedYen: 9_000, netYen: 13_000 },
    { dateKey: "2026-W30", label: "7/27週", usageSeconds: 50_400, earnedYen: 39_000, wastedYen: 6_000, netYen: 33_000 },
    { dateKey: "2026-W31", label: "8/3週", usageSeconds: 48_600, earnedYen: 38_000, wastedYen: 8_500, netYen: 29_500 },
  ],
  month: [
    { dateKey: "2026-04", label: "4月", usageSeconds: 144_000, earnedYen: 112_000, wastedYen: 28_000, netYen: 84_000 },
    { dateKey: "2026-05", label: "5月", usageSeconds: 158_400, earnedYen: 125_000, wastedYen: 24_000, netYen: 101_000 },
    { dateKey: "2026-06", label: "6月", usageSeconds: 136_800, earnedYen: 108_000, wastedYen: 31_000, netYen: 77_000 },
    { dateKey: "2026-07", label: "7月", usageSeconds: 172_800, earnedYen: 138_000, wastedYen: 22_000, netYen: 116_000 },
    { dateKey: "2026-08", label: "8月", usageSeconds: 48_600, earnedYen: 38_000, wastedYen: 8_500, netYen: 29_500 },
  ],
};

export const demoGraphQueryService: GraphQueryService = {
  async getGraphData({ period, metric }: GraphQueryParams): Promise<GraphData> {
    return {
      period,
      metric,
      points: DEMO_POINTS[period],
    };
  },
};

export function isGraphMetric(value: string): value is GraphMetric {
  return ["usageSeconds", "earnedYen", "wastedYen", "netYen"].includes(value);
}
