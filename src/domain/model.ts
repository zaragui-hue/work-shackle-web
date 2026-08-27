import { z } from "zod";

export const TASK_STATUSES = [
  "not_started", "in_progress", "paused", "waiting", "completed", "cancelled",
] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const WORK_STATUS_TYPES = [
  "working", "focus_brick", "meeting", "urgent_insert", "chased_by_requirements",
  "slacking", "gossip", "drinking", "lunch", "nap", "daydream", "preparing_leave", "overtime",
] as const;
export type WorkStatusType = (typeof WORK_STATUS_TYPES)[number];

export type TaskReminder = { id: string; taskId: string; remindAtMs: number; message?: string; enabled: boolean };
export type TaskPostponement = { id: string; taskId: string; oldDeadlineAtMs: number; newDeadlineAtMs: number; reason: string; createdAtMs: number };
export type Task = {
  id: string;
  title: string;
  note?: string;
  plannedAtMs: number;
  deadlineAtMs?: number;
  priority: number;
  status: TaskStatus;
  createdAtMs: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
  updatedAtMs: number;
};
export type WorkdayReminder = { id: string; time: string; label: string; message: string; suggestedStatus: WorkStatusType; enabled: boolean };
export type WorkStatusRecord = { id: string; statusType: WorkStatusType; workDate: string; displayCopy: string; startAtMs: number; endAtMs?: number };
export type OvertimeRecord = { id: string; workDate: string; startAtMs: number; autoEndAtMs: number; endAtMs?: number };
export type WebData = {
  schemaVersion: 1;
  updatedAtMs: number;
  tasks: Task[];
  taskReminders: TaskReminder[];
  postponements: TaskPostponement[];
  schedule: {
    defaultStart: string;
    defaultEnd: string;
    lunchStart: string;
    lunchEnd: string;
    todayOverrides: Record<string, { start: string; end: string }>;
  };
  workdayReminders: WorkdayReminder[];
  reminderFires: { key: string; firedAtMs: number }[];
  workStatusRecords: WorkStatusRecord[];
  lunchDismissedDates: string[];
  overtimeRecords: OvertimeRecord[];
  workEndDecisions: { id: string; workDate: string; kind: "normal" | "overtime"; decidedAtMs: number }[];
};

const clock = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/);
const taskSchema = z.object({
  id: z.string().min(1), title: z.string().min(1), note: z.string().optional(),
  plannedAtMs: z.number().int(), deadlineAtMs: z.number().int().optional(), priority: z.number().int().min(1).max(3),
  status: z.enum(TASK_STATUSES), createdAtMs: z.number().int(), completedAtMs: z.number().int().optional(),
  cancelledAtMs: z.number().int().optional(), updatedAtMs: z.number().int(),
});
const reminderSchema = z.object({ id: z.string(), taskId: z.string(), remindAtMs: z.number().int(), message: z.string().optional(), enabled: z.boolean() });
const workdayReminderSchema = z.object({ id: z.string(), time: clock, label: z.string(), message: z.string(), suggestedStatus: z.enum(WORK_STATUS_TYPES), enabled: z.boolean() });

export const WebDataSchema: z.ZodType<WebData> = z.object({
  schemaVersion: z.literal(1), updatedAtMs: z.number().int(), tasks: z.array(taskSchema), taskReminders: z.array(reminderSchema),
  postponements: z.array(z.object({ id: z.string(), taskId: z.string(), oldDeadlineAtMs: z.number().int(), newDeadlineAtMs: z.number().int(), reason: z.string(), createdAtMs: z.number().int() })),
  schedule: z.object({ defaultStart: clock, defaultEnd: clock, lunchStart: clock, lunchEnd: clock, todayOverrides: z.record(z.string(), z.object({ start: clock, end: clock })) }),
  workdayReminders: z.array(workdayReminderSchema), reminderFires: z.array(z.object({ key: z.string(), firedAtMs: z.number().int() })),
  workStatusRecords: z.array(z.object({ id: z.string(), statusType: z.enum(WORK_STATUS_TYPES), workDate: z.string(), displayCopy: z.string(), startAtMs: z.number().int(), endAtMs: z.number().int().optional() })),
  lunchDismissedDates: z.array(z.string()),
  overtimeRecords: z.array(z.object({ id: z.string(), workDate: z.string(), startAtMs: z.number().int(), autoEndAtMs: z.number().int(), endAtMs: z.number().int().optional() })),
  workEndDecisions: z.array(z.object({ id: z.string(), workDate: z.string(), kind: z.enum(["normal", "overtime"]), decidedAtMs: z.number().int() })),
});

export type TodayTasks = { formalTasks: Task[]; overdueTasks: Task[]; completedTodayTasks: Task[]; autoStartedTaskIds: string[] };
export type TaskInput = { title: string; note?: string; plannedAtMs: number; deadlineAtMs?: number; priority: number; reminders?: { remindAtMs: number; message?: string }[] };
