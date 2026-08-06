export const NAVIGATION_ITEMS = [
  {
    id: "timer",
    label: "タイマー",
    note: "計測とリアルタイム確認",
  },
  {
    id: "calendar",
    label: "カレンダー",
    note: "日ごとの利用履歴確認",
  },
  {
    id: "graph",
    label: "グラフ",
    note: "利用時間の可視化",
  },
  {
    id: "settings",
    label: "設定",
    note: "時間価値や各種設定",
  },
] as const;

export type NavigationId = (typeof NAVIGATION_ITEMS)[number]["id"];
