import {
  addDays,
  addMonths,
  addQuarters,
  addWeeks,
  addYears,
  format,
  parseISO,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  startOfYear,
} from "date-fns";

import { CALENDAR_WEEK_OPTIONS, toLocalDateKey } from "../calendar/calendarGrid";

export const HISTORY_TIME_MODES = [
  { id: "day", label: "日" },
  { id: "week", label: "周" },
  { id: "month", label: "月" },
  { id: "quarter", label: "季度" },
  { id: "year", label: "年" },
  { id: "custom", label: "自定义" },
] as const;

export type HistoryTimeMode = (typeof HISTORY_TIME_MODES)[number]["id"];

export type HistoryFilterState = {
  mode: HistoryTimeMode;
  anchorDate: string;
  customStartDate: string;
  customEndDate: string;
};

export function createDefaultHistoryFilter(today: Date = new Date()): HistoryFilterState {
  const anchorDate = toLocalDateKey(today);
  return {
    mode: "day",
    anchorDate,
    customStartDate: anchorDate,
    customEndDate: anchorDate,
  };
}

export function validateCustomRange(startDate: string, endDate: string): string | null {
  if (!startDate || !endDate) {
    return "请选择开始和结束日期";
  }
  if (startDate > endDate) {
    return "开始日期不能晚于结束日期";
  }
  return null;
}

export function formatHistoryPeriodLabel(filter: HistoryFilterState): string {
  const anchor = parseISO(filter.anchorDate);

  switch (filter.mode) {
    case "day":
      return format(anchor, "yyyy年M月d日");
    case "week": {
      const weekStart = startOfWeek(anchor, CALENDAR_WEEK_OPTIONS);
      const weekEnd = addDays(weekStart, 6);
      return `${format(weekStart, "yyyy年M月d日")} – ${format(weekEnd, "M月d日")}`;
    }
    case "month":
      return format(startOfMonth(anchor), "yyyy年M月");
    case "quarter": {
      const quarterStart = startOfQuarter(anchor);
      return `${format(quarterStart, "yyyy年")} Q${Math.floor(quarterStart.getMonth() / 3) + 1}`;
    }
    case "year":
      return format(startOfYear(anchor), "yyyy年");
    case "custom": {
      const start = parseISO(filter.customStartDate);
      const end = parseISO(filter.customEndDate);
      if (filter.customStartDate === filter.customEndDate) {
        return format(start, "yyyy年M月d日");
      }
      return `${format(start, "yyyy年M月d日")} – ${format(end, "M月d日")}`;
    }
    default:
      return "";
  }
}

export function shiftHistoryAnchor(
  filter: HistoryFilterState,
  direction: -1 | 1,
): HistoryFilterState {
  const anchor = parseISO(filter.anchorDate);

  switch (filter.mode) {
    case "day":
      return { ...filter, anchorDate: toLocalDateKey(addDays(anchor, direction)) };
    case "week":
      return { ...filter, anchorDate: toLocalDateKey(addWeeks(anchor, direction)) };
    case "month":
      return { ...filter, anchorDate: toLocalDateKey(addMonths(anchor, direction)) };
    case "quarter":
      return { ...filter, anchorDate: toLocalDateKey(addQuarters(anchor, direction)) };
    case "year":
      return { ...filter, anchorDate: toLocalDateKey(addYears(anchor, direction)) };
    case "custom":
      return filter;
    default:
      return filter;
  }
}

export function toHistoryTasksQuery(filter: HistoryFilterState) {
  if (filter.mode === "custom") {
    return {
      mode: filter.mode,
      startDate: filter.customStartDate,
      endDate: filter.customEndDate,
    };
  }

  return {
    mode: filter.mode,
    anchorDate: filter.anchorDate,
  };
}

export function historyFilterKey(filter: HistoryFilterState): string {
  if (filter.mode === "custom") {
    return `${filter.mode}:${filter.customStartDate}:${filter.customEndDate}`;
  }
  return `${filter.mode}:${filter.anchorDate}`;
}
