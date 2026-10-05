import {
  WEEKDAY_LABELS,
  createMonthCells,
  type CalendarDate,
  type DateTimeOptions,
  type YearMonth,
} from "../dateOptions";

type MonthCalendarProps = {
  value: YearMonth;
  configuredDates: DateTimeOptions;
  rangeStart: string | null;
  selectedDates: Set<string>;
  onDateClick: (date: CalendarDate) => void;
};

// 1か月分の日付と、選択・設定済みの状態を表示する。
export function MonthCalendar({
  value,
  configuredDates,
  rangeStart,
  selectedDates,
  onDateClick,
}: MonthCalendarProps) {
  const cells = createMonthCells(value);
  return (
    <section className="option-month" aria-label={`${value.year}年${value.month}月`}>
      <h2>
        {value.year}年 <strong>{value.month}月</strong>
      </h2>
      <div className="option-month-grid">
        {WEEKDAY_LABELS.map((weekday, index) => (
          <span className={`option-weekday weekday-${index}`} key={weekday}>
            {weekday}
          </span>
        ))}
        {cells.map((date, index) =>
          date ? (
            <button
              className={`option-date${selectedDates.has(date.key) ? " is-selected" : ""}${configuredDates[date.key] ? " is-configured" : ""}${rangeStart === date.key ? " is-range-start" : ""}`}
              type="button"
              key={date.key}
              aria-pressed={selectedDates.has(date.key)}
              onClick={() => onDateClick(date)}
            >
              <span>{date.day}</span>
              {configuredDates[date.key] && (
                <small>{configuredDates[date.key].length}枠</small>
              )}
            </button>
          ) : (
            <span className="option-date is-empty" key={`empty-${index}`} />
          ),
        )}
      </div>
    </section>
  );
}
