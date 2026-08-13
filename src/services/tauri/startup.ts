import { invoke } from "@tauri-apps/api/core";

import { ErrorCode, type Phase1ErrorCode } from "./errorCodes";

export type StartupReady = {
  workspacePath: string;
};

export type AppError =
  | { code: typeof ErrorCode.ValidationFailed; details: { reason: string } }
  | { code: typeof ErrorCode.WorkspaceNotFound; details: { path: string } }
  | {
      code: typeof ErrorCode.WorkspaceNotWritable;
      details: { path: string; message: string };
    }
  | { code: typeof ErrorCode.DbOpenFailed; details: { message: string } }
  | { code: typeof ErrorCode.DbMigrationFailed; details: { message: string } }
  | { code: typeof ErrorCode.DatabaseError; details: { message: string } }
  | { code: typeof ErrorCode.AppNotReady; details: { message: string } }
  | { code: typeof ErrorCode.ConfigReadFailed; details: { message: string } }
  | { code: typeof ErrorCode.ConfigWriteFailed; details: { message: string } }
  | { code: typeof ErrorCode.InvalidPath; details: { message: string } }
  | { code: Phase1ErrorCode; details: Record<string, unknown> };

export type StartupViewState =
  | "preparing"
  | "ready"
  | "workspaceNotFound"
  | "workspaceNotWritable"
  | "databaseInitFailed"
  | "validationFailed";

export function mapStartupError(error: AppError): {
  state: StartupViewState;
  message: string;
} {
  switch (error.code) {
    case ErrorCode.WorkspaceNotFound:
      return {
        state: "workspaceNotFound",
        message: "工作目录找不到",
      };
    case ErrorCode.WorkspaceNotWritable:
      return {
        state: "workspaceNotWritable",
        message: "工作目录不可写",
      };
    case ErrorCode.DbOpenFailed:
    case ErrorCode.DbMigrationFailed:
    case ErrorCode.DatabaseError:
    case ErrorCode.AppNotReady:
      return {
        state: "databaseInitFailed",
        message: "数据库初始化失败",
      };
    case ErrorCode.ValidationFailed:
      return {
        state: "validationFailed",
        message: "工作目录不可用",
      };
    default:
      return {
        state: "databaseInitFailed",
        message: "启动失败",
      };
  }
}

export async function initializeApp(): Promise<StartupReady> {
  return invoke<StartupReady>("initialize_app");
}
