export const REMINDER_WINDOW_LABEL = "ddl-reminder";
export const REMINDER_WINDOW_SHOW_EVENT = "reminder://window-show";
export const REMINDER_OPEN_TASK_EVENT = "reminder://open-task";

export type CustomReminderTriggeredPayload = {
  kind: "custom";
  reminderId: string;
  taskId: string;
  taskTitle: string;
  remindAtMs: number;
  firedAtMs: number;
  message?: string;
};

export type SystemReminderTriggeredPayload = {
  kind: "system";
  taskId: string;
  taskTitle: string;
  reminderKind: string;
  deadlineSnapshotMs: number;
  triggerAtMs: number;
  firedAtMs: number;
};

export type ReminderTriggeredPayload =
  | CustomReminderTriggeredPayload
  | SystemReminderTriggeredPayload;

export type ReminderWindowShowPayload = {
  primary: ReminderTriggeredPayload;
  additionalCount: number;
};

export type ReminderOpenTaskPayload = {
  taskId: string;
};
