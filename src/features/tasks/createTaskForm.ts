import { format } from "date-fns";
import { z } from "zod";

import type { CreateTaskInput } from "../../services/tauri/tasks";

export const TASK_PRIORITIES = [
  { value: 1, label: "🫧 不急", hint: "反正老板也不催" },
  { value: 2, label: "🙂 正常", hint: "该干还是得干" },
  { value: 3, label: "😵 有点急", hint: "再拖就要被问了" },
  { value: 4, label: "🔥 很急", hint: "已经有人开始等了" },
  { value: 5, label: "🚨 现在立刻马上要", hint: "别排了，先干这个" },
] as const;

export const REMINDER_LIMIT = 3;
export const REMINDER_LIMIT_COPY = "最多 3 个提醒，先别把自己催疯。";

const reminderSchema = z.object({
  remindAt: z.string().min(1, "请选择提醒时间"),
  message: z.string().max(200, "提醒说明最多 200 字").optional(),
});

export const createTaskFormSchema = z
  .object({
    title: z.string().trim().min(1, "任务名称必填"),
    note: z.string().max(2000, "备注最多 2000 字").optional(),
    plannedAt: z.string().min(1, "请选择计划时间"),
    deadlineAt: z.string().optional(),
    priority: z.number().int().min(1).max(5),
    contactId: z.string().optional(),
    reminders: z
      .array(reminderSchema)
      .max(REMINDER_LIMIT, REMINDER_LIMIT_COPY),
  })
  .superRefine((values, context) => {
    if (!values.deadlineAt) {
      return;
    }

    const plannedAtMs = datetimeLocalToMs(values.plannedAt);
    const deadlineAtMs = datetimeLocalToMs(values.deadlineAt);
    if (Number.isNaN(plannedAtMs) || Number.isNaN(deadlineAtMs)) {
      return;
    }

    if (deadlineAtMs < plannedAtMs) {
      context.addIssue({
        code: "custom",
        message: "DDL 不能早于计划时间",
        path: ["deadlineAt"],
      });
    }
  });

export type CreateTaskFormValues = z.infer<typeof createTaskFormSchema>;

export function defaultPlannedAtLocal(): string {
  const now = new Date();
  now.setSeconds(0, 0);
  return format(now, "yyyy-MM-dd'T'HH:mm");
}

export function datetimeLocalToMs(value: string): number {
  return new Date(value).getTime();
}

export function createDefaultFormValues(): CreateTaskFormValues {
  return {
    title: "",
    note: "",
    plannedAt: defaultPlannedAtLocal(),
    deadlineAt: "",
    priority: 2,
    contactId: undefined,
    reminders: [],
  };
}

export function toCreateTaskInput(values: CreateTaskFormValues): CreateTaskInput {
  const note = values.note?.trim();

  return {
    title: values.title.trim(),
    note: note ? note : undefined,
    plannedAtMs: datetimeLocalToMs(values.plannedAt),
    deadlineAtMs: values.deadlineAt
      ? datetimeLocalToMs(values.deadlineAt)
      : undefined,
    priority: values.priority,
    contactId: values.contactId,
    reminders: values.reminders.map((reminder) => ({
      remindAtMs: datetimeLocalToMs(reminder.remindAt),
      message: reminder.message?.trim() ? reminder.message.trim() : undefined,
    })),
  };
}
