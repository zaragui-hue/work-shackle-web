import { invoke } from "@tauri-apps/api/core";

export type CalendarDayTaskCount = {
  date: string;
  taskCount: number;
};

export type CalendarTaskCountQuery = {
  startDate: string;
  endDate: string;
};

export async function queryCalendarTaskCounts(
  query: CalendarTaskCountQuery,
): Promise<CalendarDayTaskCount[]> {
  return invoke<CalendarDayTaskCount[]>("query_calendar_task_counts", { query });
}

export function calendarTaskCountsToMap(
  entries: CalendarDayTaskCount[],
): Record<string, number> {
  return Object.fromEntries(entries.map((entry) => [entry.date, entry.taskCount]));
}
