import { format, formatDistanceStrict, isSameDay } from "date-fns";
import { zhCN } from "date-fns/locale";

const HOUR_MS = 60 * 60 * 1_000;

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

export function dedupeTodayTaskGroups<T extends { id: string }>(
  formalTasks: T[],
  overdueTasks: T[],
): { formalTasks: T[]; overdueTasks: T[] } {
  const overdueIds = new Set(overdueTasks.map((task) => task.id));
  return {
    formalTasks: formalTasks.filter((task) => !overdueIds.has(task.id)),
    overdueTasks,
  };
}

export function overdueTreatmentPrompt(
  deadlineAtMs: number,
  nowMs = Date.now(),
): string {
  const overdueMs = Math.max(0, nowMs - deadlineAtMs);
  if (overdueMs >= 72 * HOUR_MS) {
    return "这活已经获得永久工位。要么重排，要么结束，别再供着。";
  }
  if (overdueMs >= 24 * HOUR_MS) {
    return "它已经在工位上扎根了。建议优先处理，今天别再养它。";
  }
  return "尸体还热。五分钟能回就快回，不行就延期，别装死。";
}
