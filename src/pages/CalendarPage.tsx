import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { DEMO_GRAPH_POINTS } from "../services/graphDemoData";
import type { GraphPoint } from "../types/graph";

const DISPLAY_YEAR = 2026;
const DISPLAY_MONTH = 8;
const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;

const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  maximumFractionDigits: 0,
});

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (hours === 0) return `${minutes}分`;
  if (minutes === 0) return `${hours}時間`;
  return `${hours}時間${minutes}分`;
}

function dateKey(day: number): string {
  return `${DISPLAY_YEAR}-${String(DISPLAY_MONTH).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function CalendarDay({ day, point, selected, onSelect }: {
  day: number;
  point?: GraphPoint;
  selected: boolean;
  onSelect: () => void;
}) {
  const isToday = day === 9;
  return (
    <button
      type="button"
      className={`demo-calendar__day${selected ? " demo-calendar__day--selected" : ""}${isToday ? " demo-calendar__day--today" : ""}`}
      aria-pressed={selected}
      aria-label={`${DISPLAY_MONTH}月${day}日${point ? `、利用時間${formatDuration(point.usageSeconds)}、純増減${yenFormatter.format(point.netYen)}` : "、記録なし"}`}
      onClick={onSelect}
    >
      <span className="demo-calendar__date">{day}</span>
      {point ? (
        <span className="demo-calendar__day-data">
          <strong>{formatDuration(point.usageSeconds)}</strong>
          <span className="demo-calendar__earned">+{yenFormatter.format(point.earnedYen)}</span>
          <span className="demo-calendar__wasted">-{yenFormatter.format(point.wastedYen)}</span>
          <span className="demo-calendar__net">+{yenFormatter.format(point.netYen)}</span>
        </span>
      ) : null}
    </button>
  );
}

export function CalendarPage() {
  const points = DEMO_GRAPH_POINTS.day;
  const [selectedDateKey, setSelectedDateKey] = useState("2026-08-09");
  const pointsByDate = useMemo(
    () => new Map(points.map((point) => [point.dateKey, point])),
    [points],
  );
  const selectedPoint = pointsByDate.get(selectedDateKey);
  const totals = points.reduce(
    (sum, point) => ({
      usageSeconds: sum.usageSeconds + point.usageSeconds,
      earnedYen: sum.earnedYen + point.earnedYen,
      wastedYen: sum.wastedYen + point.wastedYen,
      netYen: sum.netYen + point.netYen,
    }),
    { usageSeconds: 0, earnedYen: 0, wastedYen: 0, netYen: 0 },
  );
  const firstWeekday = new Date(DISPLAY_YEAR, DISPLAY_MONTH - 1, 1).getDay();
  const daysInMonth = new Date(DISPLAY_YEAR, DISPLAY_MONTH, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? day : null;
  });

  return (
    <main className="page demo-calendar">
      <header className="demo-calendar__header">
        <div>
          <p className="demo-calendar__eyebrow">MONTHLY REPORT</p>
          <h2>カレンダー</h2>
        </div>
        <span className="demo-calendar__badge">デモデータ</span>
      </header>

      <section className="demo-calendar__summary" aria-label="2026年8月の合計">
        <div className="demo-calendar__month-control">
          <button type="button" aria-label="前月" disabled><ChevronLeft aria-hidden="true" /></button>
          <h3>2026年 8月</h3>
          <button type="button" aria-label="翌月" disabled><ChevronRight aria-hidden="true" /></button>
        </div>
        <dl className="demo-calendar__summary-values">
          <div><dt>利用時間</dt><dd>{formatDuration(totals.usageSeconds)}</dd></div>
          <div><dt>獲得</dt><dd className="demo-calendar__earned">+{yenFormatter.format(totals.earnedYen)}</dd></div>
          <div><dt>浪費</dt><dd className="demo-calendar__wasted">-{yenFormatter.format(totals.wastedYen)}</dd></div>
          <div><dt>純増減</dt><dd className="demo-calendar__net">+{yenFormatter.format(totals.netYen)}</dd></div>
        </dl>
      </section>

      <div className="demo-calendar__content">
        <section className="demo-calendar__grid-panel" aria-label="2026年8月のカレンダー">
          <div className="demo-calendar__weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="demo-calendar__grid">
            {cells.map((day, index) => day === null ? (
              <span className="demo-calendar__day demo-calendar__day--outside" key={`outside-${index}`} />
            ) : (
              <CalendarDay
                key={day}
                day={day}
                point={pointsByDate.get(dateKey(day))}
                selected={selectedDateKey === dateKey(day)}
                onSelect={() => setSelectedDateKey(dateKey(day))}
              />
            ))}
          </div>
        </section>

        <aside className="demo-calendar__detail" aria-live="polite">
          <p className="demo-calendar__detail-date">8月{Number(selectedDateKey.slice(-2))}日</p>
          {selectedPoint ? (
            <>
              <h3>{formatDuration(selectedPoint.usageSeconds)}</h3>
              <dl>
                <div><dt>獲得額</dt><dd className="demo-calendar__earned">+{yenFormatter.format(selectedPoint.earnedYen)}</dd></div>
                <div><dt>浪費額</dt><dd className="demo-calendar__wasted">-{yenFormatter.format(selectedPoint.wastedYen)}</dd></div>
                <div className="demo-calendar__detail-net"><dt>純増減</dt><dd>+{yenFormatter.format(selectedPoint.netYen)}</dd></div>
              </dl>
            </>
          ) : (
            <div className="demo-calendar__empty">
              <h3>記録なし</h3>
              <p>この日の利用データはありません。</p>
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
