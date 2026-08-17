import type { SessionRecord } from "../../../types/sessionRecord";

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"] as const;
const yenFormatter = new Intl.NumberFormat("ja-JP");

function formatYen(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${yenFormatter.format(Math.abs(value))}円`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  if (hours === 0) return `${minutes}分`;
  return `${hours}時間${minutes > 0 ? `${minutes}分` : ""}`;
}

function getCalendarParts(localDateKey: string) {
  const [year, month, day] = localDateKey.split("-").map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array.from({ length: 42 }, (_, index) => {
    const value = index - firstWeekday + 1;
    return value >= 1 && value <= daysInMonth ? value : null;
  });
  return { year, month, day, cells };
}

export type CalendarPreviewProps = Readonly<{
  record: SessionRecord;
}>;

export function CalendarPreview({ record }: CalendarPreviewProps) {
  const { year, month, day, cells } = getCalendarParts(record.localDateKey);

  return (
    <section className="calendar-preview" aria-labelledby="calendar-preview-title">
      <div className="calendar-preview__summary">
        <strong>{year}年 {month}月</strong>
        <dl>
          <div><dt>利用時間</dt><dd>{formatDuration(record.durationSeconds)}</dd></div>
          <div><dt>獲得</dt><dd className="calendar-preview__earned">{formatYen(record.totals.earnedYen)}</dd></div>
          <div><dt>浪費</dt><dd className="calendar-preview__wasted">{formatYen(-record.totals.wastedYen)}</dd></div>
          <div><dt>純増減</dt><dd className="calendar-preview__net">{formatYen(record.totals.netYen)}</dd></div>
        </dl>
      </div>

      <div className="calendar-preview__body">
        <div className="calendar-preview__month" aria-label={`${year}年${month}月のカレンダー`}>
          <h2 id="calendar-preview-title">カレンダー</h2>
          <div className="calendar-preview__weekdays" aria-hidden="true">
            {WEEKDAYS.map((weekday) => <span key={weekday}>{weekday}</span>)}
          </div>
          <div className="calendar-preview__grid">
            {cells.map((cell, index) => {
              const selected = cell === day;
              return (
                <div
                  key={`${cell ?? "outside"}-${index}`}
                  className={`calendar-preview__cell${selected ? " calendar-preview__cell--selected" : ""}${cell === null ? " calendar-preview__cell--outside" : ""}`}
                >
                  {cell === null ? null : (
                    <>
                      <span className="calendar-preview__cell-date">{cell}</span>
                      {selected ? (
                        <span className="calendar-preview__cell-values">
                          <strong>{formatDuration(record.durationSeconds)}</strong>
                          <span className="calendar-preview__earned">{formatYen(record.totals.earnedYen)}</span>
                          <span className="calendar-preview__wasted">{formatYen(-record.totals.wastedYen)}</span>
                          <span className="calendar-preview__net">{formatYen(record.totals.netYen)}</span>
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <aside className="calendar-preview__detail" aria-label={`${month}月${day}日の記録`}>
          <h3>{month}月{day}日</h3>
          <dl className="calendar-preview__detail-summary">
            <div><dt>利用時間</dt><dd>{formatDuration(record.durationSeconds)}</dd></div>
            <div><dt>獲得</dt><dd className="calendar-preview__earned">{formatYen(record.totals.earnedYen)}</dd></div>
            <div><dt>浪費</dt><dd className="calendar-preview__wasted">{formatYen(-record.totals.wastedYen)}</dd></div>
            <div><dt>純増減</dt><dd className="calendar-preview__net">{formatYen(record.totals.netYen)}</dd></div>
          </dl>
          <h4>アプリ別の内訳</h4>
          <ul>
            {record.apps.map((app) => (
              <li key={`${app.appId}-${app.processName}`}>
                <span>{app.processName}</span>
                <strong>{formatDuration(app.durationSeconds)}</strong>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </section>
  );
}
