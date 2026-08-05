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

  useEffect(() => {
    useActivityStore.getState().startMeasurement();

    const intervalId = window.setInterval(() => {
      useActivityStore.getState().syncElapsed();
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {pageMap[currentPage]}
    </AppLayout>
  );
}
