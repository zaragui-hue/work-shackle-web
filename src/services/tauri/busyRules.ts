import { invoke } from "@tauri-apps/api/core";

import { ErrorCode, type Phase1ErrorCode } from "./errorCodes";
import { TaskErrorCode, type TaskIpcErrorCode } from "./tasks";

export type BusyLevelMessage = {
  id: string;
  content: string;
};

export type BusyLevelRule = {
  id: string;
  minTasks: number;
  maxTasks: number | null;
  emoji: string;
  name: string;
  sortOrder: number;
  messages: BusyLevelMessage[];
};

export type SaveBusyLevelInput = {
  minTasks: number;
  maxTasks: number | null;
  emoji: string;
  name: string;
  messages: string[];
};

export type SaveBusyRulesInput = {
  levels: SaveBusyLevelInput[];
};

export type BusyRulesAppError =
  | { code: typeof TaskErrorCode.InvalidTaskInput; details: { message: string } }
  | { code: typeof ErrorCode.AppNotReady; details: { message: string } }
  | { code: typeof ErrorCode.DatabaseError; details: { message: string } }
  | { code: TaskIpcErrorCode; details: Record<string, unknown> }
  | { code: Phase1ErrorCode; details: Record<string, unknown> };

export const BUSY_RULES_UPDATED_EVENT = "work-shackle:busy-rules-updated";

const listeners = new Set<() => void>();

export function subscribeBusyRules(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function notifyBusyRulesUpdated(): void {
  listeners.forEach((listener) => listener());
  window.dispatchEvent(new CustomEvent(BUSY_RULES_UPDATED_EVENT));
}

export function mapBusyRulesError(error: BusyRulesAppError): string {
  switch (error.code) {
    case TaskErrorCode.InvalidTaskInput: {
      const message = error.details.message;
      return typeof message === "string" && message.length > 0
        ? message
        : "忙碌规则无效，请检查后再保存";
    }
    case ErrorCode.AppNotReady:
      return "应用尚未就绪";
    case ErrorCode.DatabaseError:
      return "数据库操作失败";
    default:
      return "忙碌规则保存失败";
  }
}

export async function getBusyRules(): Promise<BusyLevelRule[]> {
  return invoke<BusyLevelRule[]>("get_busy_rules");
}

export async function saveBusyRules(input: SaveBusyRulesInput): Promise<BusyLevelRule[]> {
  const saved = await invoke<BusyLevelRule[]>("save_busy_rules", { input });
  notifyBusyRulesUpdated();
  return saved;
}

export function formatBusyRangeLabel(
  minTasks: number,
  maxTasks: number | null,
  isLastLevel: boolean,
): string {
  if (isLastLevel || maxTasks === null) {
    return `${minTasks}+`;
  }
  if (minTasks === maxTasks) {
    return `${minTasks}`;
  }
  return `${minTasks} ～ ${maxTasks}`;
}

export function toBusyLevel(level: BusyLevelRule) {
  return {
    emoji: level.emoji,
    name: level.name,
    minTasks: level.minTasks,
    maxTasks: level.maxTasks,
  };
}

export function sortBusyLevels(levels: BusyLevelRule[]): BusyLevelRule[] {
  return [...levels].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.minTasks - right.minTasks;
  });
}
