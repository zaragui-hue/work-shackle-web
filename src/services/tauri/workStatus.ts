import { invoke } from "@tauri-apps/api/core";

import { refreshDynamicAppIconAfter } from "./dynamicAppIconEvents";
import { ErrorCode, type Phase1ErrorCode } from "./errorCodes";
import { TaskErrorCode, type TaskIpcErrorCode } from "./tasks";

export type FixedWorkStatus = {
  id: string;
  emoji: string;
  name: string;
  sortOrder: number;
  selectable: boolean;
};

export type CurrentWorkStatus = {
  recordId: string;
  statusType: string;
  emoji: string;
  name: string;
  displayCopy: string;
  workDate: string;
  startAtMs: number;
};

export type StatusCopy = {
  id: string;
  statusType: string;
  content: string;
  createdAtMs: number;
};

export type SaveStatusCopyInput = {
  statusType: string;
  content: string;
};

export type WorkStatusAppError =
  | { code: typeof TaskErrorCode.InvalidTaskInput; details: { message: string } }
  | { code: typeof ErrorCode.AppNotReady; details: { message: string } }
  | { code: typeof ErrorCode.DatabaseError; details: { message: string } }
  | { code: TaskIpcErrorCode; details: Record<string, unknown> }
  | { code: Phase1ErrorCode; details: Record<string, unknown> };

export function mapWorkStatusError(error: WorkStatusAppError): string {
  switch (error.code) {
    case TaskErrorCode.InvalidTaskInput:
      return "工作状态无效，请重试";
    case ErrorCode.AppNotReady:
      return "应用尚未就绪";
    case ErrorCode.DatabaseError:
      return "数据库操作失败";
    default:
      return "工作状态操作失败";
  }
}

export async function listWorkStatuses(): Promise<FixedWorkStatus[]> {
  return invoke<FixedWorkStatus[]>("list_work_statuses");
}

export async function getCurrentWorkStatus(): Promise<CurrentWorkStatus | null> {
  return invoke<CurrentWorkStatus | null>("get_current_work_status");
}

export async function switchWorkStatus(
  statusType: string,
): Promise<CurrentWorkStatus> {
  return refreshDynamicAppIconAfter(
    invoke<CurrentWorkStatus>("switch_work_status", {
      input: { statusType },
    }),
  );
}

export async function listStatusCopies(
  statusType: string,
): Promise<StatusCopy[]> {
  return invoke<StatusCopy[]>("list_status_copies", { statusType });
}

export async function saveStatusCopy(
  input: SaveStatusCopyInput,
): Promise<StatusCopy> {
  return invoke<StatusCopy>("save_status_copy", { input });
}
