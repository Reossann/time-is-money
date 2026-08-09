import React, { useEffect, useRef, useState } from "react";
import { AppLayout } from "./components/layout/AppLayout";
import { ResultFlowLive } from "./components/result/ResultFlowLive";
import { ResultFlowPreview } from "./components/result/ResultFlowPreview";
import { useNavigation } from "./hooks/useNavigation";
import { useMeasurementTracking } from "./hooks/useMeasurementTracking";
import { useResultFlowStore } from "./stores/useResultFlowStore";
import { useActivityStore } from "./stores/useActivityStore";
import { TimerPage } from "./pages/TimerPage";
import { CalendarPage } from "./pages/CalendarPage";
import { GraphPage } from "./pages/GraphPage";
import { SettingsPage } from "./pages/SettingsPage";
import { startNativeWebAppBridgeListener } from "./services/nativeBridgeService";
import type { NavigationId } from "./constants/navigation";

const pageMap: Record<NavigationId, React.ReactNode> = {
  timer: null, // TimerPage は特別な props を持つため下で個別に処理
  calendar: <CalendarPage />,
  graph: <GraphPage />,
  settings: <SettingsPage />,
};

export function App() {
  const { currentPage, setCurrentPage } = useNavigation();
  const [isResultFlowOpen, setIsResultFlowOpen] = useState(false);
  const finalizedResult = useActivityStore((state) => state.finalizedResult);
  const openedResultSessionId = useRef<string | null>(null);
  useMeasurementTracking();

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let isDisposed = false;

    startNativeWebAppBridgeListener()
      .then((dispose) => {
        if (isDisposed) {
          dispose();
          return;
        }

        unlisten = dispose;
      })
      .catch((error) => {
        console.error("Native WebApp bridge listener の開始に失敗しました", error);
      });

    return () => {
      isDisposed = true;
      unlisten?.();
    };
  }, []);

  const openResultFlowPreview = () => {
    useResultFlowStore.getState().start("preview");
    setIsResultFlowOpen(true);
  };

  useEffect(() => {
    if (
      finalizedResult === null ||
      openedResultSessionId.current === finalizedResult.sessionId
    ) {
      return;
    }

    openedResultSessionId.current = finalizedResult.sessionId;
    useResultFlowStore.getState().start("live");
    setIsResultFlowOpen(true);
  }, [finalizedResult]);

  const exitResultFlow = () => {
    setIsResultFlowOpen(false);
    setCurrentPage("timer");
    useResultFlowStore.getState().reset();
  };

  if (isResultFlowOpen) {
    if (finalizedResult !== null) {
      return <ResultFlowLive onExit={exitResultFlow} result={finalizedResult} />;
    }
    return <ResultFlowPreview onExit={exitResultFlow} />;
  }

  const renderCurrentPage = (): React.ReactNode => {
    if (currentPage === "timer") {
      return <TimerPage onPreviewResultFlow={openResultFlowPreview} />;
    }

    const content = pageMap[currentPage];
    if (content === undefined) {
      return (
        <main className="page">
          <h2>エラー</h2>
          <div className="error-section" role="alert" style={{ color: "red" }}>
            <p>⚠️ 指定されたページ（{currentPage}）が見つかりませんでした。</p>
          </div>
        </main>
      );
    }

    return content;
  };

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderCurrentPage()}
    </AppLayout>
  );
}
