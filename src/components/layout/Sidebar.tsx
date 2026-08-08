import {
  NAVIGATION_ITEMS,
  type NavigationId,
} from "../../constants/navigation";
import { Clock, Calendar, BarChart, Settings } from "lucide-react";

type SidebarProps = {
  currentPage: NavigationId;
  onNavigate: (page: NavigationId) => void;
};

export function Sidebar({ currentPage, onNavigate }: SidebarProps) {
  const ICON_MAP = {
    timer: <Clock size={18} />,
    calendar: <Calendar size={18} />,
    graph: <BarChart size={18} />,
    settings: <Settings size={18} />,
  } as const;
  return (
    <aside className="sidebar" aria-label="画面ナビゲーション">
      <div className="sidebar__brand">
        <span className="sidebar__eyebrow">Time Is Money</span>
        <h1 className="sidebar__title">利用時間の見える化</h1>
        <p className="sidebar__description">
          最初の雛形として、画面遷移だけを先に用意しています。
        </p>
      </div>

      <nav className="sidebar__nav">
        {NAVIGATION_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={
              currentPage === item.id
                ? "sidebar__item sidebar__item--active"
                : "sidebar__item"
            }
            onClick={() => onNavigate(item.id)}
            aria-current={currentPage === item.id ? "page" : undefined}
          >
            <span className="sidebar__item-icon" aria-hidden="true">
              {ICON_MAP[item.id]}
            </span>
            <div className="sidebar__item-content">
              <span className="sidebar__item-label">{item.label}</span>
              <span className="sidebar__item-note">{item.note}</span>
            </div>
          </button>
        ))}
      </nav>
    </aside>
  );
}
