import { useCallback, useEffect, useRef, useState } from "react";

import type { WorkSchedule } from "../../services/tauri/settings";
import { useWorkStatus } from "./WorkStatusContext";
import type { WorkdayReminderManager } from "./useWorkdayReminders";
import {
  AUTOMATIC_FOCUS_STATUS,
  AUTOMATIC_PREPARE_STATUS,
} from "./workStatusOptions";

export type WorkdayStatusNotice = {
  tone: "success" | "error";
  title: string;
  message: string;
};

export function useWorkdayStatusAutomation(
  manager: WorkdayReminderManager,
  schedule?: WorkSchedule | null,
) {
  const { switchStatus } = useWorkStatus();
  const [notice, setNotice] = useState<WorkdayStatusNotice | null>(null);
  const [failedTarget, setFailedTarget] = useState<string | null>(null);
  const [switching, setSwitching] = useState(false);
  const previousActiveKey = useRef<string | null>(null);
  const lastAppliedTarget = useRef<string | null>(null);

  const attempt = useCallback(async (target: string) => {
    setSwitching(true);
    try {
      await switchStatus(target);
      lastAppliedTarget.current = target;
      setFailedTarget(null);
      setNotice(null);
    } catch {
      // Suppress automatic retry loops; the notice exposes an explicit retry action.
      lastAppliedTarget.current = target;
      setFailedTarget(target);
      setNotice({
        tone: "error",
        title: "状态没切过去，工位拒绝配合",
        message: "原状态已保留，可以手动重试。",
      });
    } finally {
      setSwitching(false);
    }
  }, [switchStatus]);

  useEffect(() => {
    const active = manager.activeReminder;
    const activeKey = active ? `${active.id}:${active.statusType}` : null;
    const wasActive = previousActiveKey.current !== null;
    const timing = schedule
      ? getPrepareLeaveTiming(schedule, manager.nowMs)
      : { inPrepareWindow: false, afterWork: false };

    let target: string | null = null;
    if (!timing.afterWork && active?.statusType) {
      target = active.statusType;
    } else if (timing.inPrepareWindow) {
      target = AUTOMATIC_PREPARE_STATUS;
    } else if (!timing.afterWork && wasActive) {
      target = AUTOMATIC_FOCUS_STATUS;
    }

    previousActiveKey.current = activeKey;
    if (!target) {
      lastAppliedTarget.current = null;
      return;
    }
    if (target !== lastAppliedTarget.current) {
      void attempt(target);
    }
  }, [attempt, manager.activeReminder, manager.nowMs, schedule]);

  return {
    notice,
    switching,
    dismiss: () => setNotice(null),
    retry: failedTarget ? () => void attempt(failedTarget) : undefined,
  };
}

function getPrepareLeaveTiming(schedule: WorkSchedule, nowMs: number) {
  const [year, month, day] = schedule.workDate.split("-").map(Number);
  const [hour, minute] = schedule.effectiveEnd.split(":").map(Number);
  const endAt = new Date(year, month - 1, day, hour, minute).getTime();
  return {
    inPrepareWindow: nowMs >= endAt - 20 * 60 * 1000 && nowMs < endAt,
    afterWork: nowMs >= endAt,
  };
}
