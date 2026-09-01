import { useCallback, useEffect, useMemo, useState } from "react";

import type { WorkSchedule } from "../../services/tauri/settings";
import {
  createWorkdayReminder,
  findActiveWorkdayReminder,
  loadWorkdayReminders,
  saveWorkdayReminders,
  sortWorkdayReminders,
  validateWorkdayReminder,
  type WorkdayReminder,
  type WorkdayReminderDraftValue,
} from "./workdayReminders";

export type WorkdayReminderDraft = {
  mode: "create" | "edit";
  value: WorkdayReminderDraftValue;
  error: string | null;
};

export type WorkdayReminderManager = {
  reminders: WorkdayReminder[];
  activeReminder: WorkdayReminder | null;
  nowMs: number;
  draft: WorkdayReminderDraft | null;
  storageError: string | null;
  startAdd: () => void;
  startEdit: (id: string) => void;
  updateDraft: (patch: Partial<WorkdayReminderDraftValue>) => void;
  saveDraft: () => void;
  cancelDraft: () => void;
  deleteDraftReminder: () => void;
  clearAll: () => boolean;
};

export function useWorkdayReminders(
  schedule?: WorkSchedule | null,
): WorkdayReminderManager {
  const storage = typeof window === "undefined" ? null : window.localStorage;
  const [reminders, setReminders] = useState<WorkdayReminder[]>(() =>
    loadWorkdayReminders(storage, schedule),
  );
  const [draft, setDraft] = useState<WorkdayReminderDraft | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 15_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!schedule?.workDate) {
      return;
    }
    setReminders(loadWorkdayReminders(storage, schedule));
    setNowMs(Date.now());
  }, [schedule?.workDate, storage]);

  const persist = useCallback((next: WorkdayReminder[]): boolean => {
    try {
      saveWorkdayReminders(storage, next);
      setStorageError(null);
      return true;
    } catch {
      setStorageError("小闹钟保存失败，请重试");
      return false;
    }
  }, [storage]);

  const startAdd = useCallback(() => {
    if (draft) {
      return;
    }
    setDraft({
      mode: "create",
      value: createWorkdayReminder(),
      error: null,
    });
    setStorageError(null);
  }, [draft]);

  const startEdit = useCallback((id: string) => {
    if (draft) {
      return;
    }
    const reminder = reminders.find((candidate) => candidate.id === id);
    if (!reminder) {
      return;
    }
    setDraft({ mode: "edit", value: { ...reminder }, error: null });
    setStorageError(null);
  }, [draft, reminders]);

  const updateDraft = useCallback((patch: Partial<WorkdayReminderDraftValue>) => {
    setDraft((current) => current ? {
      ...current,
      value: { ...current.value, ...patch },
      error: null,
    } : null);
    setStorageError(null);
  }, []);

  const saveDraft = useCallback(() => {
    if (!draft) {
      return;
    }
    const error = validateWorkdayReminder(draft.value, reminders, schedule);
    if (error) {
      setDraft((current) => current ? { ...current, error } : null);
      return;
    }
    const statusType = draft.value.statusType;
    if (!statusType) {
      setDraft((current) => current ? { ...current, error: "请选择提醒内容" } : null);
      return;
    }
    const saved: WorkdayReminder = { ...draft.value, statusType };
    const next = sortWorkdayReminders(
      draft.mode === "create"
        ? [...reminders, saved]
        : reminders.map((reminder) => reminder.id === saved.id ? saved : reminder),
    );
    if (!persist(next)) {
      setDraft((current) => current
        ? { ...current, error: "保存失败，请重试" }
        : null);
      return;
    }
    setReminders(next);
    setDraft(null);
    setNowMs(Date.now());
  }, [draft, persist, reminders, schedule]);

  const cancelDraft = useCallback(() => {
    setDraft(null);
    setStorageError(null);
  }, []);

  const deleteDraftReminder = useCallback(() => {
    if (!draft || draft.mode !== "edit") {
      return;
    }
    const next = reminders.filter((reminder) => reminder.id !== draft.value.id);
    if (!persist(next)) {
      setDraft((current) => current
        ? { ...current, error: "删除失败，请重试" }
        : null);
      return;
    }
    setReminders(next);
    setDraft(null);
    setNowMs(Date.now());
  }, [draft, persist, reminders]);

  const clearAll = useCallback((): boolean => {
    if (draft || !persist([])) {
      return false;
    }
    setReminders([]);
    setNowMs(Date.now());
    return true;
  }, [draft, persist]);

  const activeReminder = useMemo(() => {
    if (!schedule?.workDate) {
      return null;
    }
    return findActiveWorkdayReminder({
      reminders,
      workDate: schedule.workDate,
      nowMs,
    });
  }, [nowMs, reminders, schedule?.workDate]);

  return useMemo(() => ({
    reminders,
    activeReminder,
    nowMs,
    draft,
    storageError,
    startAdd,
    startEdit,
    updateDraft,
    saveDraft,
    cancelDraft,
    deleteDraftReminder,
    clearAll,
  }), [
    activeReminder,
    cancelDraft,
    clearAll,
    deleteDraftReminder,
    draft,
    nowMs,
    reminders,
    saveDraft,
    startAdd,
    startEdit,
    storageError,
    updateDraft,
  ]);
}
