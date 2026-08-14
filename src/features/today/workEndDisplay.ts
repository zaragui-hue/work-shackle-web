import type { WorkEndPhase } from "../../services/tauri/workEndDecision";

export function isWorkDayFinished(phase: WorkEndPhase | undefined): boolean {
  return phase === "normal_off" || phase === "overtime_finished";
}
