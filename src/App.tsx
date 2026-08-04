import { useEffect } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { useNavigation } from "./hooks/useNavigation";
import { useActivityStore } from "./stores/useActivityStore";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { RulesPage } from "./pages/RulesPage";
import { SettingsPage } from "./pages/SettingsPage";

const pageMap = {
  dashboard: <DashboardPage />,
  history: <HistoryPage />,
  rules: <RulesPage />,
  settings: <SettingsPage />,
} as const;

export function App() {
  const { currentPage, setCurrentPage } = useNavigation();

  // タイマーロジック：アプリマウント時に、1秒ごとに increment を実行
  useEffect(() => {
    try {
      const state = useActivityStore.getState();

      // ストアの状態を検証
      if (!state || typeof state.increment !== "function") {
        throw new Error(
          "エラー: アクティビティストアの状態が不正です。"
        );
      }

      if (!state.isRunning) return;

      const intervalId = setInterval(() => {
        try {
          const { increment } = useActivityStore.getState();
          if (typeof increment !== "function") {
            throw new Error("エラー: increment 関数が見つかりません。");
          }
          increment();
        } catch (err) {
          const errorMsg =
            err instanceof Error
              ? err.message
              : "タイマーの実行中にエラーが発生しました。";
          console.error(errorMsg);
        }
      }, 1000);

      // クリーンアップ：コンポーネントアンマウント時に clearInterval
      return () => clearInterval(intervalId);
    } catch (err) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : "タイマーの初期化に失敗しました。";
      console.error(errorMsg);
    }
  }, []);

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {pageMap[currentPage]}
    </AppLayout>
  );
}
