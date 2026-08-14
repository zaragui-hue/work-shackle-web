import { invoke } from "@tauri-apps/api/core";

export type WorkEndPhase =
  | "before_end"
  | "pending_decision"
  | "normal_off"
  | "overtime_active";

export type WorkEndState = {
  workDate: string;
  effectiveEnd: string;
  phase: WorkEndPhase;
  displayCopy: string | null;
};

export async function getWorkEndState(): Promise<WorkEndState> {
  return invoke<WorkEndState>("get_work_end_state");
}

export async function confirmNormalOffWork(): Promise<WorkEndState> {
  return invoke<WorkEndState>("confirm_normal_off_work");
}
