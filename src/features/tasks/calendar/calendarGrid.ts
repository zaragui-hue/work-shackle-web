import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/** Monday-first week labels (PRD / Architecture). */
export const WEEKDAY_LABELS = ["一", "二", "三", "四", "五", "六", "日"] as const;

export const CALENDAR_WEEK_OPTIONS = { weekStartsOn: 1 as const };

export type CalendarDayCell = {
  date: Date;
  /** Local calendar day `YYYY-MM-DD` — not UTC. */
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
};

export function toLocalDateKey(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

export function buildCalendarGrid(
  visibleMonth: Date,
  today: Date = new Date(),
): CalendarDayCell[] {
  const monthStart = startOfMonth(visibleMonth);
  const monthEnd = endOfMonth(visibleMonth);
  const gridStart = startOfWeek(monthStart, CALENDAR_WEEK_OPTIONS);
  const gridEnd = endOfWeek(monthEnd, CALENDAR_WEEK_OPTIONS);

  return eachDayOfInterval({ start: gridStart, end: gridEnd }).map((date) => ({
    date,
    dateKey: toLocalDateKey(date),
    dayNumber: date.getDate(),
    isCurrentMonth: isSameMonth(date, visibleMonth),
    isToday: isSameDay(date, today),
  }));
}

export function formatCalendarMonthTitle(visibleMonth: Date): string {
  return format(visibleMonth, "yyyy 年 M 月");
}

export function formatCalendarDayLabel(date: Date): string {
  return format(date, "yyyy年M月d日");
}

export function isMondayFirstGrid(cells: CalendarDayCell[]): boolean {
  if (cells.length === 0) {
    return true;
  }
  return cells[0].date.getDay() === 1;
}

export function areCalendarCellsContiguous(cells: CalendarDayCell[]): boolean {
  for (let index = 1; index < cells.length; index += 1) {
    const expected = addDays(cells[index - 1].date, 1);
    if (!isSameDay(expected, cells[index].date)) {
      return false;
    }
  }
  return true;
}
