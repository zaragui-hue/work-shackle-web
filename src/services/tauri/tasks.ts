import { invoke } from "@tauri-apps/api/core";

import { ErrorCode, type Phase1ErrorCode } from "./errorCodes";

export const TASK_IPC_ERROR_CODES = [
  "TASK_NOT_FOUND",
  "INVALID_TASK_INPUT",
  "INVALID_DEADLINE",
  "REMINDER_LIMIT_REACHED",
] as const;

export type TaskIpcErrorCode = (typeof TASK_IPC_ERROR_CODES)[number];

export const TaskErrorCode = {
  TaskNotFound: "TASK_NOT_FOUND",
  InvalidTaskInput: "INVALID_TASK_INPUT",
  InvalidDeadline: "INVALID_DEADLINE",
  ReminderLimitReached: "REMINDER_LIMIT_REACHED",
} as const satisfies Record<string, TaskIpcErrorCode>;

type TaskErrorCodeValue = (typeof TaskErrorCode)[keyof typeof TaskErrorCode];
type MissingFromTaskErrorCode = Exclude<TaskIpcErrorCode, TaskErrorCodeValue>;
type ExtraInTaskErrorCode = Exclude<TaskErrorCodeValue, TaskIpcErrorCode>;
type TaskErrorCodeContractOk = MissingFromTaskErrorCode extends never
  ? ExtraInTaskErrorCode extends never
    ? true
    : never
  : never;

/** Compile-time guard: Rust task IPC codes must match `TaskErrorCode`. */
const taskErrorCodeContract: TaskErrorCodeContractOk = true;
void taskErrorCodeContract;

export type TaskStatus =
  | "not_started"
  | "in_progress"
  | "paused"
  | "waiting"
  | "completed"
  | "cancelled";

export type Task = {
  id: string;
  title: string;
  note?: string;
  plannedAtMs: number;
  deadlineAtMs?: number;
  priority: number;
  status: TaskStatus;
  contactId?: string;
  contactSnapshot?: string;
  createdAtMs: number;
  completedAtMs?: number;
  cancelledAtMs?: number;
  updatedAtMs: number;
};

export type TaskReminder = {
  id: string;
  taskId: string;
  remindAtMs: number;
  message?: string;
  enabled: boolean;
};

export type TaskPostponement = {
  id: string;
  taskId: string;
  oldDeadlineAtMs: number;
  newDeadlineAtMs: number;
  reason: string;
  createdAtMs: number;
};

export type TaskDetail = {
  task: Task;
  reminders: TaskReminder[];
  postponements: TaskPostponement[];
};

export type CreateTaskReminderInput = {
  remindAtMs: number;
  message?: string;
};

export type CreateTaskInput = {
  title: string;
  note?: string;
  plannedAtMs: number;
  deadlineAtMs?: number;
  priority?: number;
  contactId?: string;
  contactSnapshot?: string;
  reminders?: CreateTaskReminderInput[];
};

export type UpdateTaskInput = {
  id: string;
  title?: string;
  note?: string | null;
  plannedAtMs?: number;
  deadlineAtMs?: number | null;
  priority?: number;
  status?: TaskStatus;
  contactId?: string | null;
  contactSnapshot?: string | null;
};

export type TaskQueryInput = {
  status?: TaskStatus;
  priority?: number;
};

export type HistoryTimeMode =
  | "day"
  | "week"
  | "month"
  | "quarter"
  | "year"
  | "custom";

export type HistoryTasksQueryInput = {
  mode: HistoryTimeMode;
  anchorDate?: string;
  startDate?: string;
  endDate?: string;
  status?: TaskStatus;
  priority?: number;
  contactId?: string;
  keyword?: string;
};

export type TodayTasks = {
  formalTasks: Task[];
  upcomingDeadlineTasks: Task[];
  overdueTasks: Task[];
  completedTodayTasks: Task[];
  autoStartedTaskIds: string[];
};

export type PostponeTaskInput = {
  taskId: string;
  newDeadlineAtMs: number;
  reason: string;
};

export type TaskAppError =
  | { code: typeof TaskErrorCode.TaskNotFound; details: { id: string } }
  | { code: typeof TaskErrorCode.InvalidTaskInput; details: { message: string } }
  | { code: typeof TaskErrorCode.InvalidDeadline; details: { message: string } }
  | { code: typeof TaskErrorCode.ReminderLimitReached; details: { limit: number } }
  | { code: typeof ErrorCode.AppNotReady; details: { message: string } }
  | { code: typeof ErrorCode.DatabaseError; details: { message: string } }
  | { code: Phase1ErrorCode; details: Record<string, unknown> };

export function isTaskIpcErrorCode(code: string): code is TaskIpcErrorCode {
  return (TASK_IPC_ERROR_CODES as readonly string[]).includes(code);
}

export function mapTaskError(error: TaskAppError): string {
  switch (error.code) {
    case TaskErrorCode.TaskNotFound:
      return "任务不存在";
    case TaskErrorCode.InvalidTaskInput:
      return "任务信息无效";
    case TaskErrorCode.InvalidDeadline:
      return "DDL 不能早于计划时间";
    case TaskErrorCode.ReminderLimitReached:
      return "最多 3 个提醒，先别把自己催疯。";
    case ErrorCode.AppNotReady:
      return "应用尚未就绪";
    case ErrorCode.DatabaseError:
      return "数据库操作失败";
    default:
      return "任务操作失败";
  }
}

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return invoke<Task>("create_task", { input });
}

export async function updateTask(input: UpdateTaskInput): Promise<Task> {
  return invoke<Task>("update_task", { input });
}

export async function getTaskDetail(id: string): Promise<TaskDetail> {
  return invoke<TaskDetail>("get_task_detail", { id });
}

export async function getTaskById(id: string): Promise<Task> {
  return invoke<Task>("get_task_by_id", { id });
}

export async function queryTasks(query: TaskQueryInput = {}): Promise<Task[]> {
  return invoke<Task[]>("query_tasks", { query });
}

export async function queryHistoryTasks(
  query: HistoryTasksQueryInput,
): Promise<Task[]> {
  return invoke<Task[]>("query_history_tasks", { query });
}

export async function queryTodayTasks(): Promise<TodayTasks> {
  return invoke<TodayTasks>("query_today_tasks");
}

export async function completeTask(id: string): Promise<Task> {
  return invoke<Task>("complete_task", { id });
}

export async function cancelTask(id: string): Promise<Task> {
  return invoke<Task>("cancel_task", { id });
}

export async function postponeTask(input: PostponeTaskInput): Promise<TaskDetail> {
  return invoke<TaskDetail>("postpone_task", { input });
}
