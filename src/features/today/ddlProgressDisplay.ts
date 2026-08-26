import { copy } from "../../config/copy";
import type { DdlEmotion } from "../../services/tauri/ddl";
import type { TaskStatus } from "../../services/tauri/tasks";

export type OverdueChaosLevel = "slightly" | "serious" | "gave_up";

const HOUR_MS = 60 * 60 * 1_000;

const STATUS_STAMP_COPY: Record<TaskStatus, string> = {
  not_started: "🫥 活还没醒",
  in_progress: "🐴 牛马强制上线",
  paused: "🫠 工位融化中",
  waiting: "🤡 等一个天降奇迹",
  completed: "✅ 活干完了",
  cancelled: "🗑️ 活消失了",
};

const OVERDUE_CHAOS_LABELS: Record<OverdueChaosLevel, string> = {
  slightly: "有点超时",
  serious: "严重超时",
  gave_up: "放弃挣扎",
};

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

export function taskStatusStampCopy(status: TaskStatus): string {
  return STATUS_STAMP_COPY[status];
}

export function overdueChaosLevel(
  deadlineAtMs: number,
  nowMs = Date.now(),
): OverdueChaosLevel {
  const overdueMs = Math.max(0, nowMs - deadlineAtMs);
  if (overdueMs >= 72 * HOUR_MS) return "gave_up";
  if (overdueMs >= 24 * HOUR_MS) return "serious";
  return "slightly";
}

export function overdueChaosLabel(level: OverdueChaosLevel): string {
  return OVERDUE_CHAOS_LABELS[level];
}
