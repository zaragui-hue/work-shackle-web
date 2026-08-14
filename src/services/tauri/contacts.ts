import { invoke } from "@tauri-apps/api/core";

import { ErrorCode, type Phase1ErrorCode } from "./errorCodes";
import { TaskErrorCode, type TaskIpcErrorCode } from "./tasks";

export type Contact = {
  id: string;
  name: string;
  isActive: boolean;
  createdAtMs: number;
  updatedAtMs: number;
};

export type CreateContactInput = {
  name: string;
};

export type ContactAppError =
  | { code: typeof TaskErrorCode.InvalidTaskInput; details: { message: string } }
  | { code: typeof ErrorCode.AppNotReady; details: { message: string } }
  | { code: typeof ErrorCode.DatabaseError; details: { message: string } }
  | { code: TaskIpcErrorCode; details: Record<string, unknown> }
  | { code: Phase1ErrorCode; details: Record<string, unknown> };

export function mapContactError(error: ContactAppError): string {
  switch (error.code) {
    case TaskErrorCode.InvalidTaskInput:
      return "对接人信息无效";
    case ErrorCode.AppNotReady:
      return "应用尚未就绪";
    case ErrorCode.DatabaseError:
      return "数据库操作失败";
    default:
      return "对接人操作失败";
  }
}

export async function listContacts(): Promise<Contact[]> {
  return invoke<Contact[]>("list_contacts");
}

export async function createContact(input: CreateContactInput): Promise<Contact> {
  return invoke<Contact>("create_contact", { input });
}

export async function deactivateContact(id: string): Promise<Contact> {
  return invoke<Contact>("deactivate_contact", { id });
}
