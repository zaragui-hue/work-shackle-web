import { useEffect, useState } from "react";

import { buildTaskPressure, type TaskPressure } from "./taskPressure";

export function useTaskPressure(
  plannedAtMs: number,
  deadlineAtMs?: number,
): TaskPressure {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const hasValidRange =
    deadlineAtMs != null && deadlineAtMs > plannedAtMs;

  useEffect(() => {
    if (!hasValidRange) return;

    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, [hasValidRange, plannedAtMs, deadlineAtMs]);

  return buildTaskPressure(plannedAtMs, deadlineAtMs, nowMs);
}
