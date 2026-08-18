import { copy } from "../../config/copy";
import type { DdlEmotion } from "../../services/tauri/ddl";

export function canShowDdlProgress(
  plannedAtMs: number | undefined,
  deadlineAtMs: number | undefined,
): boolean {
  return (
    plannedAtMs != null &&
    deadlineAtMs != null &&
    deadlineAtMs > plannedAtMs
  );
}

export function formatTimeElapsedCopy(progressRatio: number): string {
  const percent = Math.round(progressRatio * 100);
  return `时间已走过 ${percent}%`;
}

export const DDL_EMOTION_LABELS: Record<DdlEmotion, string> = copy.ddl.emotions;

export function ddlEmotionLabel(emotion: DdlEmotion): string {
  return DDL_EMOTION_LABELS[emotion];
}

export function ddlProgressFillPercent(progressRatio: number): number {
  if (!Number.isFinite(progressRatio) || progressRatio <= 0) {
    return 0;
  }
  return Math.min(100, progressRatio * 100);
}
