import { invoke } from "@tauri-apps/api/core";

import { ErrorCode, type Phase1ErrorCode } from "./errorCodes";
import { TaskErrorCode, type TaskIpcErrorCode } from "./tasks";

export type WorkSchedule = {
  workDate: string;
  defaultStart: string;
  defaultEnd: string;
  effectiveStart: string;
  effectiveEnd: string;
  hasTodayOverride: boolean;
};

export type LunchSchedule = {
  lunchStart: string;
  lunchEnd: string;
};

export type SaveLunchTimesInput = {
  lunchStart: string;
  lunchEnd: string;
};

export type SaveWorkTimesInput = {
  startTime: string;
  endTime: string;
};

export type SettingsAppError =
  | { code: typeof TaskErrorCode.InvalidTaskInput; details: { message: string } }
  | { code: typeof ErrorCode.AppNotReady; details: { message: string } }
  | { code: typeof ErrorCode.DatabaseError; details: { message: string } }
  | { code: TaskIpcErrorCode; details: Record<string, unknown> }
  | { code: Phase1ErrorCode; details: Record<string, unknown> };

export function mapSettingsError(error: SettingsAppError): string {
  switch (error.code) {
    case TaskErrorCode.InvalidTaskInput:
      return "时间设置无效，请检查后再保存";
    case ErrorCode.AppNotReady:
      return "应用尚未就绪";
    case ErrorCode.DatabaseError:
      return "数据库操作失败";
    default:
      return "工作时间设置失败";
  }
}

export async function getWorkSchedule(): Promise<WorkSchedule> {
  return invoke<WorkSchedule>("get_work_schedule");
}

export async function saveDefaultWorkTimes(
  input: SaveWorkTimesInput,
): Promise<WorkSchedule> {
  return invoke<WorkSchedule>("save_default_work_times", { input });
}

export async function saveTodayWorkOverride(
  input: SaveWorkTimesInput,
): Promise<WorkSchedule> {
  return invoke<WorkSchedule>("save_today_work_override", { input });
}

export async function clearTodayWorkOverride(): Promise<WorkSchedule> {
  return invoke<WorkSchedule>("clear_today_work_override");
}

export async function getLunchSchedule(): Promise<LunchSchedule> {
  return invoke<LunchSchedule>("get_lunch_schedule");
}

export async function saveLunchTimes(
  input: SaveLunchTimesInput,
): Promise<LunchSchedule> {
  return invoke<LunchSchedule>("save_lunch_times", { input });
}

export function formatWorkTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}
