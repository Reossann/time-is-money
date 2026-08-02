import type { ReactNode } from "react";

import { Sidebar } from "@/components/layout/Sidebar";
import type { NavigationId } from "@/constants/navigation";

type AppLayoutProps = {
  currentPage: NavigationId;
  onNavigate: (page: NavigationId) => void;
  children: ReactNode;
};

export function AppLayout({
  currentPage,
  onNavigate,
  children,
}: AppLayoutProps) {
  return (
    <div className="app-shell">
      <Sidebar currentPage={currentPage} onNavigate={onNavigate} />
      <div className="app-main">
        <div className="app-main__surface">{children}</div>
      </div>
    </div>
  );
}
