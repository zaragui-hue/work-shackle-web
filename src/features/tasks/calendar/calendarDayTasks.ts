import type { Task } from "../../../services/tauri/tasks";
import type { CalendarDayTasks } from "../../../services/tauri/calendar";

export function countCalendarDayTasks(dayTasks: CalendarDayTasks): number {
  return (
    dayTasks.formalTasks.length +
    dayTasks.overdueTasks.length +
    dayTasks.completedTasks.length +
    dayTasks.cancelledTasks.length
  );
}

export function countCalendarDayActiveTasks(dayTasks: CalendarDayTasks): number {
  return dayTasks.formalTasks.length + dayTasks.overdueTasks.length;
}

export function flattenCalendarDayTasks(dayTasks: CalendarDayTasks): Task[] {
  return [
    ...dayTasks.formalTasks,
    ...dayTasks.overdueTasks,
    ...dayTasks.completedTasks,
    ...dayTasks.cancelledTasks,
  ];
}
