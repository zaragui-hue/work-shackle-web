import { invoke } from "@tauri-apps/api/core";

import { ErrorCode, type Phase1ErrorCode } from "./errorCodes";

export type WorkspaceSource = "configured" | "default";

export type WorkspaceStatus = {
  configuredPath?: string;
  resolvedPath: string;
  source: WorkspaceSource;
  isValid: boolean;
  validationError?: string;
};

export type WorkspaceAppError =
  | { code: typeof ErrorCode.ValidationFailed; details: { reason: string } }
  | { code: typeof ErrorCode.WorkspaceNotFound; details: { path: string } }
  | {
      code: typeof ErrorCode.WorkspaceNotWritable;
      details: { path: string; message: string };
    }
  | { code: typeof ErrorCode.WorkspaceTargetNotEmpty; details: { path: string } }
  | { code: typeof ErrorCode.WorkspaceSwitchFailed; details: { message: string } }
  | { code: typeof ErrorCode.ConfigWriteFailed; details: { message: string } }
  | { code: typeof ErrorCode.DbOpenFailed; details: { message: string } }
  | { code: typeof ErrorCode.DbMigrationFailed; details: { message: string } }
  | { code: typeof ErrorCode.AppNotReady; details: { message: string } }
  | { code: Phase1ErrorCode; details: Record<string, unknown> };

export function mapWorkspaceError(error: WorkspaceAppError): string {
  switch (error.code) {
    case ErrorCode.ValidationFailed:
      return "所选目录不能作为工作目录";
    case ErrorCode.WorkspaceNotFound:
      return "工作目录找不到";
    case ErrorCode.WorkspaceNotWritable:
      return "工作目录不可写";
    case ErrorCode.WorkspaceTargetNotEmpty:
      return "目标目录非空，且不是有效的 Work Shackle 工作目录";
    case ErrorCode.WorkspaceSwitchFailed:
      return typeof error.details.message === "string" && error.details.message
        ? error.details.message
        : "切换工作目录失败";
    case ErrorCode.ConfigWriteFailed:
      return "保存工作目录设置失败";
    case ErrorCode.DbOpenFailed:
    case ErrorCode.DbMigrationFailed:
      return "目标工作目录的数据库无法打开";
    case ErrorCode.WorkspaceNetworkDriveUnsupported:
      return "不支持网络盘作为工作目录";
    case ErrorCode.WorkspaceRemovableDriveUnsupported:
      return "不支持可移动磁盘作为工作目录";
    case ErrorCode.WorkspaceDriveTypeUnknown:
      return "无法识别目标磁盘类型";
    case ErrorCode.AppNotReady:
      return "应用尚未就绪";
    default:
      return "工作目录操作失败";
  }
}

export async function getWorkspaceStatus(): Promise<WorkspaceStatus> {
  return invoke<WorkspaceStatus>("get_workspace_status");
}

export async function validateWorkspaceCandidate(path: string): Promise<void> {
  return invoke<void>("validate_workspace_candidate", { path });
}

export async function setWorkspacePath(path: string): Promise<WorkspaceStatus> {
  return invoke<WorkspaceStatus>("set_workspace_path_command", { path });
}

export async function resolveDefaultWorkspacePath(): Promise<string> {
  return invoke<string>("resolve_default_workspace_path");
}
