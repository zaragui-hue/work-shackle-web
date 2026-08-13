import { invoke } from "@tauri-apps/api/core";

export type StartupReady = {
  workspacePath: string;
};

export type AppError =
  | { code: "validationFailed"; details: { reason: string } }
  | { code: "workspaceNotFound"; details: { path: string } }
  | { code: "workspaceNotWritable"; details: { path: string; message: string } }
  | { code: "databaseInitFailed"; details: { message: string } }
  | { code: "configReadFailed"; details: { message: string } }
  | { code: "configWriteFailed"; details: { message: string } }
  | { code: "invalidPath"; details: { message: string } };

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
    case "workspaceNotFound":
      return {
        state: "workspaceNotFound",
        message: "工作目录找不到",
      };
    case "workspaceNotWritable":
      return {
        state: "workspaceNotWritable",
        message: "工作目录不可写",
      };
    case "databaseInitFailed":
      return {
        state: "databaseInitFailed",
        message: "数据库初始化失败",
      };
    case "validationFailed":
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
