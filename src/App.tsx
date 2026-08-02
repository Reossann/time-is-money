import { AppLayout } from "@/components/layout/AppLayout";
import { useNavigation } from "@/hooks/useNavigation";
import { DashboardPage } from "@/pages/DashboardPage";
import { HistoryPage } from "@/pages/HistoryPage";
import { RulesPage } from "@/pages/RulesPage";
import { SettingsPage } from "@/pages/SettingsPage";

const pageMap = {
  dashboard: <DashboardPage />,
  history: <HistoryPage />,
  rules: <RulesPage />,
  settings: <SettingsPage />,
} as const;

export function App() {
  const { currentPage, setCurrentPage } = useNavigation();

  return (
    <AppLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {pageMap[currentPage]}
    </AppLayout>
  );
}
