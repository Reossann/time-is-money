import { useEffect, useState } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { ResultFlowPreview } from "./components/result/ResultFlowPreview";
import { useNavigation } from "./hooks/useNavigation";
import { useActivityStore } from "./stores/useActivityStore";
import { useResultFlowStore } from "./stores/useResultFlowStore";
import { DashboardPage } from "./pages/DashboardPage";
import { HistoryPage } from "./pages/HistoryPage";
import { RulesPage } from "./pages/RulesPage";
import { SettingsPage } from "./pages/SettingsPage";

const pageMap = {
  history: <HistoryPage />,
  rules: <RulesPage />,
  settings: <SettingsPage />,
} as const;

export function App() {
  const { currentPage, setCurrentPage } = useNavigation();
  const [isResultFlowOpen, setIsResultFlowOpen] = useState(false);

  useEffect(() => {
    useActivityStore.getState().startMeasurement();

    const intervalId = window.setInterval(() => {
      useActivityStore.getState().syncElapsed();
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  const openResultFlowPreview = () => {
    useResultFlowStore.getState().start("preview");
    setIsResultFlowOpen(true);
  };

  const exitResultFlow = () => {
    setIsResultFlowOpen(false);
    useResultFlowStore.getState().reset();
  };

  if (isResultFlowOpen) {
    return <ResultFlowPreview onExit={exitResultFlow} />;
  }

  const currentPageContent =
    currentPage === "dashboard" ? (
      <DashboardPage onPreviewResultFlow={openResultFlowPreview} />
    ) : (
      pageMap[currentPage]
    );

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {currentPageContent}
    </AppLayout>
  );
}
