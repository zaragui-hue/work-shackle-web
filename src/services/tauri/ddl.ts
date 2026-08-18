import { invoke } from "@tauri-apps/api/core";

export type DdlEmotion =
  | "calm"
  | "notice"
  | "anxious"
  | "panic"
  | "burning"
  | "overdue";

export type DdlProgress = {
  progressRatio: number;
  remainingMs: number;
  isOverdue: boolean;
  emotion: DdlEmotion;
};

export type ComputeDdlProgressInput = {
  plannedAtMs: number;
  deadlineAtMs: number;
  nowMs: number;
};

export async function computeDdlProgress(
  input: ComputeDdlProgressInput,
): Promise<DdlProgress> {
  return invoke<DdlProgress>("compute_ddl_progress", input);
}
