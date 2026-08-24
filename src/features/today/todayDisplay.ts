import { format, formatDistanceStrict, isSameDay } from "date-fns";
import { zhCN } from "date-fns/locale";

export function formatPlannedTime(plannedAtMs: number): string {
  return format(new Date(plannedAtMs), "M/d HH:mm");
}

export function formatRemainingUntilDeadline(
  deadlineAtMs: number,
  nowMs = Date.now(),
): string {
  if (deadlineAtMs <= nowMs) {
    return "已到点";
  }
  return `还剩 ${formatDistanceStrict(deadlineAtMs, nowMs, { locale: zhCN })}`;
}

export function formatOverdueDuration(
  deadlineAtMs: number,
  nowMs = Date.now(),
): string {
  if (deadlineAtMs >= nowMs) {
    return "";
  }
  return `已逾期 ${formatDistanceStrict(nowMs, deadlineAtMs, { locale: zhCN })}`;
}

export function isDeadlineOverdueToday(
  deadlineAtMs: number | undefined,
  nowMs = Date.now(),
): boolean {
  if (deadlineAtMs == null) {
    return false;
  }
  return (
    isSameDay(new Date(deadlineAtMs), new Date(nowMs)) && deadlineAtMs < nowMs
  );
}

export function formatCompletedTime(completedAtMs: number): string {
  return format(new Date(completedAtMs), "HH:mm 完成");
}

export function countVisibleTodayTasks(tasks: {
  formalTasks: unknown[];
  overdueTasks: unknown[];
}): number {
  return tasks.formalTasks.length + tasks.overdueTasks.length;
}

export function isTodayFullyEmpty(tasks: {
  formalTasks: unknown[];
  upcomingDeadlineTasks: unknown[];
  overdueTasks: unknown[];
  completedTodayTasks: unknown[];
}): boolean {
  return (
    tasks.formalTasks.length === 0 &&
    tasks.overdueTasks.length === 0 &&
    tasks.completedTodayTasks.length === 0
  );
}
