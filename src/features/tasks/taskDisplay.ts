import { format } from "date-fns";

import type { Task, TaskStatus } from "../../services/tauri/tasks";
import { TASK_PRIORITIES } from "./createTaskForm";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "未开始",
  in_progress: "进行中",
  paused: "暂停",
  waiting: "等别人",
  completed: "已完成",
  cancelled: "已取消",
};

const priorityByValue = new Map(TASK_PRIORITIES.map((item) => [item.value, item]));

export function priorityLabel(priority: number): string {
  return priorityByValue.get(priority as (typeof TASK_PRIORITIES)[number]["value"])?.label ?? `优先级 ${priority}`;
}

export function statusLabel(status: TaskStatus): string {
  return TASK_STATUS_LABELS[status];
}

export function formatDeadline(deadlineAtMs?: number): string {
  if (deadlineAtMs == null) {
    return "无";
  }
  return format(new Date(deadlineAtMs), "yyyy-MM-dd HH:mm");
}

/** Compact deadline for list scanning: "8/16 18:00" or empty marker. */
export function formatDeadlineShort(deadlineAtMs?: number): string {
  if (deadlineAtMs == null) {
    return "无 DDL";
  }
  return format(new Date(deadlineAtMs), "M/d HH:mm");
}

export function priorityToneClass(priority: number): string {
  const tone = Math.min(5, Math.max(1, Math.round(priority)));
  return `priority-tone--${tone}`;
}

export function formatContact(task: Task): string {
  return task.contactSnapshot?.trim() || "—";
}

export function isTerminalStatus(status: TaskStatus): boolean {
  return status === "completed" || status === "cancelled";
}

export function msToDatetimeLocal(value: number): string {
  return format(new Date(value), "yyyy-MM-dd'T'HH:mm");
}

export function formatReminderTime(remindAtMs: number): string {
  return format(new Date(remindAtMs), "yyyy-MM-dd HH:mm");
}

export function formatPostponementRange(oldDeadlineAtMs: number, newDeadlineAtMs: number): string {
  return `${format(new Date(oldDeadlineAtMs), "M/d HH:mm")} → ${format(new Date(newDeadlineAtMs), "M/d HH:mm")}`;
}

export function postponementCountLabel(count: number): string {
  return `↪ 已延期 ${count} 次`;
}
