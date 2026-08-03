import type { ReactNode } from "react";

import type { NavigationId } from "../../constants/navigation";
import { Sidebar } from "./Sidebar";

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
