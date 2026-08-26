import { format } from "date-fns";
import { z } from "zod";

import type { CreateTaskInput } from "../../services/tauri/tasks";
import { currentMinuteValue, isBeforeCurrentMinute } from "./taskDateTime";

export const TASK_PRIORITIES = [
  { value: 1, label: "🫧 不急", hint: "反正老板也不催" },
  { value: 2, label: "🙂 正常", hint: "该干还是得干" },
  { value: 3, label: "😵 有点急", hint: "再拖就要被问了" },
  { value: 4, label: "🔥 很急", hint: "已经有人开始等了" },
  { value: 5, label: "🚨 现在立刻马上要", hint: "别排了，先干这个" },
] as const;

export const taskCoreFormShape = {
  title: z.string().trim().min(1, "任务名称必填"),
  note: z.string().max(2000, "备注最多 2000 字").optional(),
  startAt: z.string().min(1, "请选择开始时间"),
  endAt: z.string().min(1, "请选择完成时间"),
  priority: z.number().int().min(1).max(5),
  contactName: z.string().max(100, "对接人最多 100 字").optional(),
};

export function taskTimeRangeError(values: { startAt: string; endAt: string }) {
  const startAtMs = datetimeLocalToMs(values.startAt);
  const endAtMs = datetimeLocalToMs(values.endAt);
  if (Number.isNaN(startAtMs) || Number.isNaN(endAtMs)) return null;
  return endAtMs <= startAtMs ? "完成时间必须晚于开始时间" : null;
}

export const createTaskFormSchema = z
  .object(taskCoreFormShape)
  .superRefine((values, context) => {
    if (isBeforeCurrentMinute(values.startAt)) {
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

export type CreateTaskFormValues = z.infer<typeof createTaskFormSchema>;

export function datetimeLocalToMs(value: string): number {
  return new Date(value).getTime();
}

export function createDefaultFormValues(now = new Date()): CreateTaskFormValues {
  const start = new Date(currentMinuteValue(now));
  const end = new Date(start);
  end.setHours(18, 0, 0, 0);
  if (end <= start) end.setDate(end.getDate() + 1);

  return {
    title: "",
    note: "",
    startAt: format(start, "yyyy-MM-dd'T'HH:mm"),
    endAt: format(end, "yyyy-MM-dd'T'HH:mm"),
    priority: 2,
    contactName: "",
  };
}

export function toCreateTaskInput(values: CreateTaskFormValues): CreateTaskInput {
  const note = values.note?.trim();
  const contactName = values.contactName?.trim();
  return {
    title: values.title.trim(),
    note: note || undefined,
    plannedAtMs: datetimeLocalToMs(values.startAt),
    deadlineAtMs: datetimeLocalToMs(values.endAt),
    priority: values.priority,
    contactSnapshot: contactName || undefined,
  };
}
