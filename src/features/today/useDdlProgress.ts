import { useEffect, useState } from "react";

import {
  computeDdlProgress,
  type DdlProgress,
} from "../../services/tauri/ddl";
import { canShowDdlProgress } from "./ddlProgressDisplay";

export const DDL_PROGRESS_REFRESH_MS = 30_000;

export function useDdlProgress(
  plannedAtMs: number | undefined,
  deadlineAtMs: number | undefined,
): DdlProgress | null {
  const [progress, setProgress] = useState<DdlProgress | null>(null);
  const canCompute = canShowDdlProgress(plannedAtMs, deadlineAtMs);

  useEffect(() => {
    if (!canCompute || plannedAtMs == null || deadlineAtMs == null) {
      setProgress(null);
      return;
    }

    const planned = plannedAtMs;
    const deadline = deadlineAtMs;
    let cancelled = false;

    async function load() {
      try {
        const next = await computeDdlProgress({
          plannedAtMs: planned,
          deadlineAtMs: deadline,
          nowMs: Date.now(),
        });
        if (!cancelled) {
          setProgress(next);
        }
      } catch {
        if (!cancelled) {
          setProgress(null);
        }
      }
    }

    void load();
    const intervalId = window.setInterval(() => {
      void load();
    }, DDL_PROGRESS_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [canCompute, plannedAtMs, deadlineAtMs]);

  return progress;
}
