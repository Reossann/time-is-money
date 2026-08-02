export const NAVIGATION_ITEMS = [
  {
    id: "dashboard",
    label: "Dashboard",
    note: "概要表示の起点",
  },
  {
    id: "history",
    label: "History",
    note: "将来の履歴一覧",
  },
  {
    id: "rules",
    label: "Rules",
    note: "分類ルールの入口",
  },
  {
    id: "settings",
    label: "Settings",
    note: "時間価値や通知設定",
  },
] as const;

export type NavigationId = (typeof NAVIGATION_ITEMS)[number]["id"];
