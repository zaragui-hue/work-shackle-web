import { z } from "zod";

import type { Task, TaskDetail, TaskStatus, UpdateTaskInput } from "../../services/tauri/tasks";
import {
  datetimeLocalToMs,
  taskCoreFormShape,
  taskTimeRangeError,
} from "./createTaskForm";
import { msToDatetimeLocal } from "./taskDisplay";

const taskStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "paused",
  "waiting",
  "completed",
  "cancelled",
]);

export const taskDrawerFormSchema = z
  .object({
    ...taskCoreFormShape,
    status: taskStatusSchema,
  })
  .superRefine((values, context) => {
    const message = taskTimeRangeError(values);
    if (message) {
      context.addIssue({
        code: "custom",
        message,
        path: ["endAt"],
      });
    }
  });

export type TaskDrawerFormValues = z.infer<typeof taskDrawerFormSchema>;

export function taskDetailToFormValues(detail: TaskDetail): TaskDrawerFormValues {
  return {
    title: detail.task.title,
    note: detail.task.note ?? "",
    startAt: msToDatetimeLocal(detail.task.plannedAtMs),
    endAt: detail.task.deadlineAtMs
      ? msToDatetimeLocal(detail.task.deadlineAtMs)
      : "",
    priority: detail.task.priority,
    contactName: detail.task.contactSnapshot ?? "",
    status: detail.task.status,
  };
}

export function toUpdateTaskInput(
  task: Task,
  values: TaskDrawerFormValues,
): UpdateTaskInput {
  const note = values.note?.trim();
  const contactName = values.contactName?.trim() ?? "";
  const originalContactName = task.contactSnapshot?.trim() ?? "";
  const contactChanged = contactName !== originalContactName;

  return {
    id: task.id,
    title: values.title.trim(),
    note: note ? note : null,
    plannedAtMs: datetimeLocalToMs(values.startAt),
    deadlineAtMs: datetimeLocalToMs(values.endAt),
    priority: values.priority,
    status: values.status as TaskStatus,
    contactId: contactChanged ? null : task.contactId ?? null,
    contactSnapshot: contactName || null,
  };
}

export const TASK_STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: "not_started", label: "未开始" },
  { value: "in_progress", label: "进行中" },
  { value: "paused", label: "暂停" },
  { value: "waiting", label: "等别人" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];
