export const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export type CalendarDate = {
  key: string;
  year: number;
  month: number;
  day: number;
  weekday: number;
};

export type YearMonth = {
  year: number;
  month: number;
};

export type DateTimeOptions = Record<string, string[]>;

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function createDateKey(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

export function parseDateKey(key: string): CalendarDate {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return { key, year, month, day, weekday: date.getDay() };
}

export function moveMonth(value: YearMonth, difference: number): YearMonth {
  const date = new Date(value.year, value.month - 1 + difference, 1);
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}

// 月の先頭に空欄を入れ、曜日位置がそろう日付配列を作る。
export function createMonthCells(value: YearMonth): Array<CalendarDate | null> {
  const firstWeekday = new Date(value.year, value.month - 1, 1).getDay();
  const lastDay = new Date(value.year, value.month, 0).getDate();
  const cells: Array<CalendarDate | null> = Array(firstWeekday).fill(null);
  for (let day = 1; day <= lastDay; day += 1) {
    const key = createDateKey(value.year, value.month, day);
    cells.push(parseDateKey(key));
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  return cells;
}

export function createDateRange(
  firstKey: string,
  secondKey: string,
  enabledWeekdays: Set<number>,
): string[] {
  const first = parseDateKey(firstKey);
  const second = parseDateKey(secondKey);
  let current = new Date(first.year, first.month - 1, first.day);
  let last = new Date(second.year, second.month - 1, second.day);
  if (current > last) {
    [current, last] = [last, current];
  }

  const keys: string[] = [];
  while (current <= last) {
    if (enabledWeekdays.has(current.getDay())) {
      keys.push(
        createDateKey(
          current.getFullYear(),
          current.getMonth() + 1,
          current.getDate(),
        ),
      );
    }
    current = new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() + 1,
    );
  }
  return keys;
}

export function createTimes(
  startTime: string,
  intervalMinutes: number,
  count: number,
): string[] {
  const [hour, minute] = startTime.split(":").map(Number);
  const startMinutes = hour * 60 + minute;
  return Array.from({ length: count }, (_, index) => {
    const totalMinutes = startMinutes + intervalMinutes * index;
    if (totalMinutes >= 24 * 60) {
      throw new Error("時刻が翌日を超えています。");
    }
    return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`;
  });
}

export function formatDateOptions(options: DateTimeOptions): string {
  return Object.entries(options)
    .filter(([, times]) => times.length > 0)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, times]) => {
      const date = parseDateKey(key);
      return [...times]
        .sort()
        .map(
          (time) =>
            `${date.month}/${date.day}（${WEEKDAY_LABELS[date.weekday]}）${time}〜`,
        )
        .join("\n");
    })
    .join("\n\n");
}
