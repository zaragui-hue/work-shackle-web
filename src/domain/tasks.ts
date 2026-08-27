import { endOfDay, isSameDay, startOfDay } from "date-fns";
import type { Task, TaskInput, TaskStatus, TodayTasks, WebData } from "./model";

export class DomainError extends Error {}

const id = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export function createTask(data: WebData, input: TaskInput, nowMs = Date.now()): WebData {
  const title = input.title.trim();
  if (!title) throw new DomainError("任务标题不能为空");
  if (input.deadlineAtMs !== undefined && input.deadlineAtMs < input.plannedAtMs) throw new DomainError("DDL 不能早于计划时间");
  if ((input.reminders?.length ?? 0) > 3) throw new DomainError("最多设置 3 个提醒");
  const task: Task = { id: id("task"), title, note: input.note?.trim() || undefined, plannedAtMs: input.plannedAtMs, deadlineAtMs: input.deadlineAtMs, priority: input.priority, status: "not_started", createdAtMs: nowMs, updatedAtMs: nowMs };
  return {
    ...data, updatedAtMs: nowMs, tasks: [...data.tasks, task],
    taskReminders: [...data.taskReminders, ...(input.reminders ?? []).map((item) => ({ id: id("reminder"), taskId: task.id, remindAtMs: item.remindAtMs, message: item.message?.trim() || undefined, enabled: true }))],
  };
}

export function updateTask(data: WebData, taskId: string, input: TaskInput, nowMs = Date.now()): WebData {
  const existing = data.tasks.find((task) => task.id === taskId);
  if (!existing) throw new DomainError("任务不存在");
  const created = createTask({ ...data, tasks: data.tasks.filter((task) => task.id !== taskId), taskReminders: data.taskReminders.filter((item) => item.taskId !== taskId) }, input, nowMs);
  const replacement = created.tasks.at(-1)!;
  return { ...created, tasks: created.tasks.map((task) => task.id === replacement.id ? { ...replacement, id: existing.id, status: existing.status, createdAtMs: existing.createdAtMs, completedAtMs: existing.completedAtMs, cancelledAtMs: existing.cancelledAtMs } : task), taskReminders: created.taskReminders.map((item) => item.taskId === replacement.id ? { ...item, taskId: existing.id } : item) };
}

export function changeTaskStatus(data: WebData, taskId: string, status: TaskStatus, nowMs = Date.now()): WebData {
  if (!data.tasks.some((task) => task.id === taskId)) throw new DomainError("任务不存在");
  return { ...data, updatedAtMs: nowMs, tasks: data.tasks.map((task) => task.id === taskId ? { ...task, status, updatedAtMs: nowMs, completedAtMs: status === "completed" ? nowMs : undefined, cancelledAtMs: status === "cancelled" ? nowMs : undefined } : task) };
}

export function setTaskPriority(data: WebData, taskId: string, priority: number, nowMs = Date.now()): WebData {
  if (![1, 2, 3].includes(priority)) throw new DomainError("优先级无效");
  return { ...data, updatedAtMs: nowMs, tasks: data.tasks.map((task) => task.id === taskId ? { ...task, priority, updatedAtMs: nowMs } : task) };
}

export function postponeTask(data: WebData, taskId: string, deadlineAtMs: number, reason: string, nowMs = Date.now()): WebData {
  const task = data.tasks.find((item) => item.id === taskId);
  if (!task?.deadlineAtMs) throw new DomainError("这个任务没有可延期的 DDL");
  if (deadlineAtMs <= task.deadlineAtMs) throw new DomainError("新 DDL 必须晚于原 DDL");
  if (!reason.trim()) throw new DomainError("请填写延期原因");
  return { ...data, updatedAtMs: nowMs, tasks: data.tasks.map((item) => item.id === taskId ? { ...item, deadlineAtMs, updatedAtMs: nowMs } : item), postponements: [...data.postponements, { id: id("postpone"), taskId, oldDeadlineAtMs: task.deadlineAtMs, newDeadlineAtMs: deadlineAtMs, reason: reason.trim(), createdAtMs: nowMs }] };
}

export function autoStartTasks(data: WebData, nowMs = Date.now()): { data: WebData; ids: string[] } {
  const ids = data.tasks.filter((task) => task.status === "not_started" && task.plannedAtMs <= nowMs && isSameDay(task.plannedAtMs, nowMs)).map((task) => task.id);
  if (!ids.length) return { data, ids };
  return { data: { ...data, updatedAtMs: nowMs, tasks: data.tasks.map((task) => ids.includes(task.id) ? { ...task, status: "in_progress", updatedAtMs: nowMs } : task) }, ids };
}

export function queryTodayTasks(data: WebData, nowMs = Date.now()): TodayTasks {
  const start = startOfDay(nowMs).getTime();
  const end = endOfDay(nowMs).getTime();
  const active = data.tasks.filter((task) => !["completed", "cancelled"].includes(task.status));
  const overdueTasks = active.filter((task) => task.deadlineAtMs !== undefined && task.deadlineAtMs < start).sort(sortTasks);
  return {
    formalTasks: active.filter((task) => task.plannedAtMs >= start && task.plannedAtMs <= end && !overdueTasks.some((item) => item.id === task.id)).sort(sortTasks),
    overdueTasks,
    completedTodayTasks: data.tasks.filter((task) => task.status === "completed" && task.completedAtMs !== undefined && task.completedAtMs >= start && task.completedAtMs <= end).sort((a, b) => (b.completedAtMs ?? 0) - (a.completedAtMs ?? 0)),
    autoStartedTaskIds: [],
  };
}

const sortTasks = (a: Task, b: Task) => a.plannedAtMs - b.plannedAtMs || b.priority - a.priority;
