export const DYNAMIC_APP_ICON_STATES = [
  "morning",
  "default",
  "afternoon",
  "offwork_soon",
  "deadline_alert",
  "overtime",
] as const;

export type DynamicAppIconState = (typeof DYNAMIC_APP_ICON_STATES)[number];

export type DynamicAppIconSnapshot = {
  nowMs: number;
  workEndAtMs?: number;
  activeOvertime?: boolean;
  isWorking?: boolean;
  nearestDeadlineAtMs?: number;
};

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export function resolveDynamicAppIconState(
  snapshot: DynamicAppIconSnapshot,
): DynamicAppIconState {
  const { nowMs, workEndAtMs, nearestDeadlineAtMs } = snapshot;

  if (
    nearestDeadlineAtMs != null
    && nearestDeadlineAtMs - nowMs <= THIRTY_MINUTES_MS
  ) {
    return "deadline_alert";
  }

  if (
    snapshot.activeOvertime
    || (snapshot.isWorking && workEndAtMs != null && nowMs >= workEndAtMs)
  ) {
    return "overtime";
  }

  if (
    workEndAtMs != null
    && nowMs < workEndAtMs
    && workEndAtMs - nowMs <= THIRTY_MINUTES_MS
  ) {
    return "offwork_soon";
  }

  const hour = new Date(nowMs).getHours();
  if (hour < 10) return "morning";
  if (hour < 14) return "default";
  return "afternoon";
}
