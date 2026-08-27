import { useCallback, useEffect, useRef, useState } from "react";

import { useWorkStatus } from "./WorkStatusContext";
import type { WorkdayReminderManager } from "./useWorkdayReminders";
import type { WorkdayReminder } from "./workdayReminders";

export type WorkdayStatusNotice = {
  tone: "success" | "error";
  title: string;
  message: string;
};

export function useWorkdayStatusAutomation(manager: WorkdayReminderManager) {
  const { switchStatus } = useWorkStatus();
  const [notice, setNotice] = useState<WorkdayStatusNotice | null>(null);
  const [failedReminder, setFailedReminder] = useState<WorkdayReminder | null>(null);
  const [switching, setSwitching] = useState(false);
  const attemptingId = useRef<string | null>(null);

  const attempt = useCallback(async (
    reminder: WorkdayReminder,
    markHandled: boolean,
  ) => {
    setSwitching(true);
    try {
      await switchStatus(reminder.suggestedStatus);
      setFailedReminder(null);
      setNotice(null);
    } catch {
      setFailedReminder(reminder);
      setNotice({
        tone: "error",
        title: "状态没切过去，工位拒绝配合",
        message: `原状态已保留。${reminder.label}可以手动重试。`,
      });
    } finally {
      if (markHandled) {
        manager.completeActive();
      }
      attemptingId.current = null;
      setSwitching(false);
    }
  }, [manager, switchStatus]);

  useEffect(() => {
    const reminder = manager.activeReminder;
    if (!reminder || attemptingId.current === reminder.id) {
      return;
    }
    attemptingId.current = reminder.id;
    void attempt(reminder, true);
  }, [attempt, manager.activeReminder]);

  return {
    notice,
    switching,
    dismiss: () => setNotice(null),
    retry: failedReminder
      ? () => void attempt(failedReminder, false)
      : undefined,
  };
}
