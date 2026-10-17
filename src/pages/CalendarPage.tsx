import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { useCalendarAggregates } from "../hooks/useCalendarAggregates";
import { aggregationClient } from "../services/aggregationClient";
import { ownerIdentityService } from "../services/ownerIdentityService";
import type { PeriodAggregate } from "../types/aggregation";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const yenFormatter = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
const formatYen = (value: number) => yenFormatter.format(value);
const formatSignedYen = (value: number) => `${value > 0 ? "+" : ""}${formatYen(value)}`;
const formatDuration = (seconds: number) => {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (hours === 0) return `${minutes}分`;
  return minutes === 0 ? `${hours}時間` : `${hours}時間${minutes}分`;
};
const dateKey = (year: number, month: number, day: number) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function CalendarDay({ day, monthKey, aggregate, selected, onSelect }: { day: number; monthKey: string; aggregate?: PeriodAggregate; selected: boolean; onSelect: () => void }) {
  const hasRecord = aggregate !== undefined && aggregate.sessionCount > 0;
  return <button type="button" className={`demo-calendar__day${selected ? " demo-calendar__day--selected" : ""}`} aria-pressed={selected} aria-label={`${Number(monthKey.slice(5, 7))}月${day}日${hasRecord ? `、利用時間${formatDuration(aggregate.durationSeconds)}、純増減${formatYen(aggregate.netYen)}` : "、記録なし"}`} onClick={onSelect}><span className="demo-calendar__date">{day}</span>{hasRecord ? <span className="demo-calendar__day-data"><strong>{formatDuration(aggregate.durationSeconds)}</strong><span className="demo-calendar__earned">+{formatYen(aggregate.earnedYen)}</span><span className="demo-calendar__wasted">-{formatYen(aggregate.wastedYen)}</span><span className="demo-calendar__net">{formatSignedYen(aggregate.netYen)}</span></span> : null}</button>;
}

export function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedDateKey, setSelectedDateKey] = useState(dateKey(today.getFullYear(), today.getMonth() + 1, today.getDate()));
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [ownerError, setOwnerError] = useState(false);
  useEffect(() => { void ownerIdentityService.getCurrentOwnerId().then(setOwnerId).catch(() => setOwnerError(true)); }, []);
  const state = useCalendarAggregates({ ownerId: ownerId ?? "pending-owner", year, month, client: aggregationClient });
  const aggregatesByDate = useMemo(() => new Map((state.data ?? []).map((item) => [item.period.key, item])), [state.data]);
  const totals = (state.data ?? []).reduce((sum, item) => ({ usageSeconds: sum.usageSeconds + item.durationSeconds, earnedYen: sum.earnedYen + item.earnedYen, wastedYen: sum.wastedYen + item.wastedYen, netYen: sum.netYen + item.netYen }), { usageSeconds: 0, earnedYen: 0, wastedYen: 0, netYen: 0 });
  const selectedAggregate = aggregatesByDate.get(selectedDateKey);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => { const day = index - firstWeekday + 1; return day >= 1 && day <= daysInMonth ? day : null; });
  const moveMonth = (delta: number) => { const next = new Date(year, month - 1 + delta, 1); setYear(next.getFullYear()); setMonth(next.getMonth() + 1); setSelectedDateKey(dateKey(next.getFullYear(), next.getMonth() + 1, 1)); };
  return <main className="page demo-calendar"><header className="demo-calendar__header"><div><p className="demo-calendar__eyebrow">MONTHLY REPORT</p><h2>カレンダー</h2></div><span className="demo-calendar__badge">保存データ</span></header><section className="demo-calendar__summary" aria-label={`${year}年${month}月の合計`}><div className="demo-calendar__month-control"><button type="button" aria-label="前月" onClick={() => moveMonth(-1)}><ChevronLeft aria-hidden="true" /></button><h3>{year}年 {month}月</h3><button type="button" aria-label="翌月" onClick={() => moveMonth(1)}><ChevronRight aria-hidden="true" /></button></div><dl className="demo-calendar__summary-values"><div><dt>利用時間</dt><dd>{formatDuration(totals.usageSeconds)}</dd></div><div><dt>獲得</dt><dd className="demo-calendar__earned">+{formatYen(totals.earnedYen)}</dd></div><div><dt>浪費</dt><dd className="demo-calendar__wasted">-{formatYen(totals.wastedYen)}</dd></div><div><dt>純増減</dt><dd className="demo-calendar__net">{formatSignedYen(totals.netYen)}</dd></div></dl></section>{ownerError || state.status === "error" ? <p role="alert">カレンダーデータを取得できませんでした。</p> : ownerId === null || state.status === "loading" ? <p role="status">カレンダーデータを読み込んでいます…</p> : null}<div className="demo-calendar__content"><section className="demo-calendar__grid-panel" aria-label={`${year}年${month}月のカレンダー`}><div className="demo-calendar__weekdays" aria-hidden="true">{WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}</div><div className="demo-calendar__grid">{cells.map((day, index) => day === null ? <span className="demo-calendar__day demo-calendar__day--outside" key={`outside-${index}`} /> : <CalendarDay key={day} day={day} monthKey={dateKey(year, month, day)} aggregate={aggregatesByDate.get(dateKey(year, month, day))} selected={selectedDateKey === dateKey(year, month, day)} onSelect={() => setSelectedDateKey(dateKey(year, month, day))} />)}</div></section><aside className="demo-calendar__detail" aria-live="polite"><p className="demo-calendar__detail-date">{month}月{Number(selectedDateKey.slice(-2))}日</p>{selectedAggregate && selectedAggregate.sessionCount > 0 ? <><h3>{formatDuration(selectedAggregate.durationSeconds)}</h3><dl><div><dt>獲得額</dt><dd className="demo-calendar__earned">+{formatYen(selectedAggregate.earnedYen)}</dd></div><div><dt>浪費額</dt><dd className="demo-calendar__wasted">-{formatYen(selectedAggregate.wastedYen)}</dd></div><div className="demo-calendar__detail-net"><dt>純増減</dt><dd>{formatSignedYen(selectedAggregate.netYen)}</dd></div></dl></> : <div className="demo-calendar__empty"><h3>記録なし</h3><p>この日の利用データはありません。</p></div>}</aside></div></main>;
}
