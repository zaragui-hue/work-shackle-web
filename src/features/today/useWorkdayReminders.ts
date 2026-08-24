import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  createWorkdayReminder,
  findDueWorkdayReminder,
  loadWorkdayReminders,
  saveWorkdayReminders,
  type WorkdayReminder,
} from "./workdayReminders";

export type WorkdayReminderManager = {
  reminders: WorkdayReminder[];
  activeReminder: WorkdayReminder | null;
  addReminder: () => void;
  updateReminder: (id: string, patch: Partial<WorkdayReminder>) => void;
  removeReminder: (id: string) => void;
  dismissActive: () => void;
  completeActive: () => void;
};

export function useWorkdayReminders(workDate?: string): WorkdayReminderManager {
  const storage = typeof window === "undefined" ? null : window.localStorage;
  const [reminders, setReminders] = useState<WorkdayReminder[]>(() =>
    loadWorkdayReminders(storage),
  );
  const [activeReminder, setActiveReminder] = useState<WorkdayReminder | null>(null);
  const handledIds = useRef(new Set<string>());

  useEffect(() => {
    saveWorkdayReminders(storage, reminders);
  }, [reminders, storage]);

  useEffect(() => {
    handledIds.current.clear();
    setActiveReminder(null);
  }, [workDate]);

  useEffect(() => {
    if (!workDate || activeReminder) {
      return;
    }
    const tick = () => {
      const due = findDueWorkdayReminder({
        reminders,
        workDate,
        nowMs: Date.now(),
        handledIds: handledIds.current,
      });
      if (due) {
        setActiveReminder(due);
      }
    };
    tick();
    const interval = window.setInterval(tick, 15_000);
    return () => window.clearInterval(interval);
  }, [activeReminder, reminders, workDate]);

  const handleActive = useCallback(() => {
    if (activeReminder) {
      handledIds.current.add(activeReminder.id);
    }
    setActiveReminder(null);
  }, [activeReminder]);

  return useMemo(() => ({
    reminders,
    activeReminder,
    addReminder: () => setReminders((current) => [...current, createWorkdayReminder()]),
    updateReminder: (id, patch) => setReminders((current) =>
      current.map((reminder) => reminder.id === id ? { ...reminder, ...patch } : reminder),
    ),
    removeReminder: (id) => setReminders((current) =>
      current.filter((reminder) => reminder.id !== id),
    ),
    dismissActive: handleActive,
    completeActive: handleActive,
  }), [activeReminder, handleActive, reminders]);
}
