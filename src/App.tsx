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
    const { isRunning } = useActivityStore.getState();
    if (!isRunning) return;

    const intervalId = setInterval(() => {
      useActivityStore.getState().increment();
    }, 1000);

    // クリーンアップ：コンポーネントアンマウント時に clearInterval
    return () => clearInterval(intervalId);
  }, []);

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {pageMap[currentPage]}
    </AppLayout>
  );
}
