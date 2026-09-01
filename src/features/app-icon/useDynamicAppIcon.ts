import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef } from "react";

import {
  DYNAMIC_APP_ICON_REFRESH_EVENT,
} from "../../services/tauri/dynamicAppIconEvents";
import { getActiveOvertime } from "../../services/tauri/overtime";
import { REMINDER_TASK_CHANGED_EVENT } from "../../services/tauri/reminder";
import { getWorkSchedule } from "../../services/tauri/settings";
import { queryTasks } from "../../services/tauri/tasks";
import type { CurrentWorkStatus } from "../../services/tauri/workStatus";
import { applyDynamicAppIcon } from "./appIconController";
import { buildDynamicAppIconSnapshot } from "./dynamicAppIconSnapshot";
import {
  resolveDynamicAppIconState,
  type DynamicAppIconSnapshot,
  type DynamicAppIconState,
} from "./dynamicAppIconState";

export type DynamicAppIconRuntime = {
  enabled: boolean;
  now(): number;
  loadSnapshot(
    nowMs: number,
    currentStatus: CurrentWorkStatus | null,
  ): Promise<DynamicAppIconSnapshot>;
  applyIcon(state: DynamicAppIconState): Promise<void>;
  onFocus(refresh: () => void): Promise<() => void>;
  onTaskChanged(refresh: () => void): Promise<() => void>;
};

const defaultRuntime: DynamicAppIconRuntime = {
  enabled: isTauri(),
  now: Date.now,
  async loadSnapshot(nowMs, currentStatus) {
    const [tasks, schedule, activeOvertime] = await Promise.all([
      queryTasks(),
      getWorkSchedule(),
      getActiveOvertime(),
    ]);
    return buildDynamicAppIconSnapshot({
      nowMs,
      tasks,
      schedule,
      activeOvertime,
      currentStatus,
    });
  },
  applyIcon: applyDynamicAppIcon,
  async onFocus(refresh) {
    return getCurrentWindow().onFocusChanged(({ payload }) => {
      if (payload) refresh();
    });
  },
  async onTaskChanged(refresh) {
    return listen(REMINDER_TASK_CHANGED_EVENT, refresh);
  },
};

export function useDynamicAppIcon(
  currentStatus: CurrentWorkStatus | null,
  runtime: DynamicAppIconRuntime = defaultRuntime,
): void {
  const applied = useRef<DynamicAppIconState | null>(null);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (!runtime.enabled || refreshing.current) return;
    refreshing.current = true;
    try {
      const snapshot = await runtime.loadSnapshot(runtime.now(), currentStatus);
      const state = resolveDynamicAppIconState(snapshot);
      if (state !== applied.current) {
        await runtime.applyIcon(state);
        applied.current = state;
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("dynamic app icon refresh failed", error);
      }
    } finally {
      refreshing.current = false;
    }
  }, [currentStatus, runtime]);

  useEffect(() => {
    if (!runtime.enabled) return;

    void refresh();
    const onRefresh = () => void refresh();
    const onVisible = () => {
      if (document.visibilityState === "visible") onRefresh();
    };
    window.addEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisible);

    let minuteInterval: number | undefined;
    const minuteTimeout = window.setTimeout(() => {
      onRefresh();
      minuteInterval = window.setInterval(onRefresh, 60_000);
    }, 60_000 - (runtime.now() % 60_000));

    let removeFocus: (() => void) | undefined;
    let removeTaskChanged: (() => void) | undefined;
    let disposed = false;
    void runtime.onFocus(onRefresh).then((remove) => {
      if (disposed) remove();
      else removeFocus = remove;
    });
    void runtime.onTaskChanged(onRefresh).then((remove) => {
      if (disposed) remove();
      else removeTaskChanged = remove;
    });

    return () => {
      disposed = true;
      window.removeEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(minuteTimeout);
      if (minuteInterval != null) window.clearInterval(minuteInterval);
      removeFocus?.();
      removeTaskChanged?.();
    };
  }, [refresh, runtime]);
}
