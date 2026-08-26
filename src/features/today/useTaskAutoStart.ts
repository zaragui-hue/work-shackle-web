import { useEffect } from "react";

import type { Task } from "../../services/tauri/tasks";

const MAX_TIMEOUT_MS = 2_147_483_647;

export function useTaskAutoStart(
  tasks: Task[],
  refresh: () => void | Promise<void>,
) {
  useEffect(() => {
    const now = Date.now();
    const nextStart = tasks
      .filter((task) => task.status === "not_started" && task.plannedAtMs > now)
      .reduce<number | null>(
        (nearest, task) =>
          nearest == null ? task.plannedAtMs : Math.min(nearest, task.plannedAtMs),
        null,
      );

    if (nextStart == null) {
      return;
    }

    const timer = window.setTimeout(
      () => void refresh(),
      Math.min(nextStart - now, MAX_TIMEOUT_MS),
    );
    return () => window.clearTimeout(timer);
  }, [refresh, tasks]);
}
