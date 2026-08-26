import { z } from "zod";

import type { Task, TaskDetail, UpdateTaskInput } from "../../services/tauri/tasks";
import {
  datetimeLocalToMs,
  taskCoreFormShape,
  taskTimeRangeError,
} from "./createTaskForm";
import { msToDatetimeLocal } from "./taskDisplay";
import { isBeforeCurrentMinute } from "./taskDateTime";

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
    if (values.status === "not_started" && isBeforeCurrentMinute(values.startAt)) {
      context.addIssue({
        code: "custom",
        message: "开始时间不能早于当前时间",
        path: ["startAt"],
      });
    }
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

  const timeUpdate = task.status === "not_started"
    ? {
        plannedAtMs: datetimeLocalToMs(values.startAt),
        deadlineAtMs: datetimeLocalToMs(values.endAt),
      }
    : {};

  return {
    id: task.id,
    title: values.title.trim(),
    note: note ? note : null,
    ...timeUpdate,
    priority: values.priority,
    contactId: contactChanged ? null : task.contactId ?? null,
    contactSnapshot: contactName || null,
  };
}
