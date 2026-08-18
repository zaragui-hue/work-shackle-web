import { invoke } from "@tauri-apps/api/core";

import type { Task } from "./tasks";

export type CalendarDayTaskCount = {
  date: string;
  taskCount: number;
};

export type CalendarTaskCountQuery = {
  startDate: string;
  endDate: string;
};

export type CalendarDayTasksQuery = {
  date: string;
};

export type CalendarDayTasks = {
  date: string;
  formalTasks: Task[];
  overdueTasks: Task[];
  completedTasks: Task[];
  cancelledTasks: Task[];
};

export async function queryCalendarTaskCounts(
  query: CalendarTaskCountQuery,
): Promise<CalendarDayTaskCount[]> {
  return invoke<CalendarDayTaskCount[]>("query_calendar_task_counts", { query });
}

export async function queryCalendarDayTasks(
  query: CalendarDayTasksQuery,
): Promise<CalendarDayTasks> {
  return invoke<CalendarDayTasks>("query_calendar_day_tasks", { query });
}

export function calendarTaskCountsToMap(
  entries: CalendarDayTaskCount[],
): Record<string, number> {
  return Object.fromEntries(entries.map((entry) => [entry.date, entry.taskCount]));
}
