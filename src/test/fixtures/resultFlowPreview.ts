import type {
  ResultFlowPreviewContent,
  ResultFlowStep,
} from "../../types/resultFlow";

export const RESULT_FLOW_PREVIEW_CONTENT = {
  finalizing: {
    title: "計測結果を確定",
    description:
      "タイマーの停止時刻と、各画面で共通利用するセッション結果を確定します。",
    responsibleIssue: "Issue #32",
  },
  "app-breakdown": {
    title: "アプリ別の利用結果",
    description:
      "アプリごとの利用時間と、獲得・浪費・neutralの分類結果を表示します。",
    responsibleIssue: "Issue #32",
  },
  "session-money": {
    title: "今回のお金への換算",
    description:
      "今回の獲得額、浪費額、純増減と、お金の演出を表示します。",
    responsibleIssue: "Issue #33",
  },
  "lifetime-money": {
    title: "これまでの累計",
    description:
      "今回の記録を含む累計獲得額、累計浪費額、累計純増減を表示します。",
    responsibleIssue: "Issue #35",
  },
  "house-equivalent": {
    title: "家への換算",
    description:
      "累計獲得額を家の完成軒数と建築中の進捗へ換算して表示します。",
    responsibleIssue: "Issue #34",
  },
  "calendar-save": {
    title: "カレンダーへ保存",
    description:
      "確定済みセッションの保存中・成功・失敗と再試行の状態を表示します。",
    responsibleIssue: "Issue #35",
  },
  improvement: {
    title: "次回への改善提案",
    description:
      "今回の利用状況に応じた提案と、設定または見送りの選択肢を表示します。",
    responsibleIssue: "Issue #38",
  },
  "returning-home": {
    title: "タイマーへ戻る",
    description:
      "保存完了を確認し、新しい計測を始められるタイマーホームへ戻ります。",
    responsibleIssue: "Issue #39",
  },
} as const satisfies Readonly<
  Record<ResultFlowStep, ResultFlowPreviewContent>
>;
