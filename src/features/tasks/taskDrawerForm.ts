import { z } from "zod";

import type { Task, TaskDetail, TaskStatus, UpdateTaskInput } from "../../services/tauri/tasks";
import { datetimeLocalToMs } from "./createTaskForm";
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
    note: z.string().max(2000, "备注最多 2000 字").optional(),
    status: taskStatusSchema,
    deadlineAt: z.string().optional(),
    contactId: z.string().optional(),
  })
  .superRefine((values, context) => {
    // Deadline vs planned time is validated on the backend using persisted planned time.
    if (!values.deadlineAt) {
      return;
    }
    const deadlineAtMs = datetimeLocalToMs(values.deadlineAt);
    if (Number.isNaN(deadlineAtMs)) {
      context.addIssue({
        code: "custom",
        message: "DDL 格式无效",
        path: ["deadlineAt"],
      });
    }
  });

export type TaskDrawerFormValues = z.infer<typeof taskDrawerFormSchema>;

export function taskDetailToFormValues(detail: TaskDetail): TaskDrawerFormValues {
  return {
    note: detail.task.note ?? "",
    status: detail.task.status,
    deadlineAt: detail.task.deadlineAtMs
      ? msToDatetimeLocal(detail.task.deadlineAtMs)
      : "",
    contactId: detail.task.contactId,
  };
}

export function toUpdateTaskInput(
  task: Task,
  values: TaskDrawerFormValues,
): UpdateTaskInput {
  const note = values.note?.trim();

  return {
    id: task.id,
    note: note ? note : null,
    status: values.status as TaskStatus,
    deadlineAtMs: values.deadlineAt
      ? datetimeLocalToMs(values.deadlineAt)
      : null,
    contactId: values.contactId ?? null,
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
