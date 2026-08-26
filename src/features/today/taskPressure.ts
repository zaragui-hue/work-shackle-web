import type { DdlEmotion } from "../../services/tauri/ddl";

export type TaskPressure = {
  valid: boolean;
  progressRatio: number;
  fillPercent: number;
  percentLabel: string;
  emotion: DdlEmotion;
  nowMs: number;
};

export function buildTaskPressure(
  plannedAtMs: number,
  deadlineAtMs: number | undefined,
  nowMs: number,
): TaskPressure {
  if (deadlineAtMs == null || deadlineAtMs <= plannedAtMs) {
    return {
      valid: false,
      progressRatio: 0,
      fillPercent: 0,
      percentLabel: "--%",
      emotion: "calm",
      nowMs,
    };
  }

  const progressRatio =
    nowMs <= plannedAtMs
      ? 0
      : (nowMs - plannedAtMs) / (deadlineAtMs - plannedAtMs);
  const roundedPercent = Math.max(0, Math.round(progressRatio * 100));

  return {
    valid: true,
    progressRatio,
    fillPercent: Math.min(100, Math.max(0, progressRatio * 100)),
    percentLabel: roundedPercent > 999 ? "999%+" : `${roundedPercent}%`,
    emotion: emotionForProgress(progressRatio),
    nowMs,
  };
}

function emotionForProgress(progressRatio: number): DdlEmotion {
  if (progressRatio > 1) return "overdue";
  if (progressRatio > 0.95) return "burning";
  if (progressRatio > 0.8) return "panic";
  if (progressRatio > 0.65) return "anxious";
  if (progressRatio > 0.4) return "notice";
  return "calm";
}
