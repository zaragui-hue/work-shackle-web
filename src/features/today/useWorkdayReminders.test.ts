import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { WorkSchedule } from "../../services/tauri/settings";
import { WORKDAY_REMINDER_STORAGE_KEY } from "./workdayReminders";
import { useWorkdayReminders } from "./useWorkdayReminders";

const schedule: WorkSchedule = {
  workDate: "2026-08-21",
  defaultStart: "09:00",
  defaultEnd: "18:00",
  effectiveStart: "09:00",
  effectiveEnd: "18:00",
  hasTodayOverride: false,
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 21, 9, 12));
  localStorage.clear();
  localStorage.setItem(WORKDAY_REMINDER_STORAGE_KEY, "[]");
});

afterEach(() => {
  vi.useRealTimers();
  localStorage.clear();
});

describe("useWorkdayReminders", () => {
  it("keeps a new row as a draft until explicit save", () => {
    const { result } = renderHook(() => useWorkdayReminders(schedule));

    act(() => result.current.startAdd());
    expect(result.current.reminders).toEqual([]);
    expect(result.current.draft).toMatchObject({
      mode: "create",
      value: {
        startTime: "10:00",
        endTime: "10:30",
        statusType: null,
      },
    });
    expect(localStorage.getItem(WORKDAY_REMINDER_STORAGE_KEY)).toBe("[]");

    act(() => result.current.updateDraft({ statusType: "meeting" }));
    act(() => result.current.saveDraft());
    expect(result.current.draft).toBeNull();
    expect(result.current.reminders).toEqual([
      expect.objectContaining({ statusType: "meeting", startTime: "10:00" }),
    ]);
    expect(localStorage.getItem(WORKDAY_REMINDER_STORAGE_KEY)).toContain("meeting");
  });

  it("locks onto one edit and cancel restores the committed row", () => {
    localStorage.setItem(WORKDAY_REMINDER_STORAGE_KEY, JSON.stringify([{
      id: "meeting",
      startTime: "10:00",
      endTime: "10:30",
      statusType: "meeting",
      createdAtMs: 1,
    }]));
    const { result } = renderHook(() => useWorkdayReminders(schedule));

    act(() => result.current.startEdit("meeting"));
    act(() => result.current.startAdd());
    expect(result.current.draft?.mode).toBe("edit");
    act(() => result.current.updateDraft({ startTime: "11:00" }));
    expect(result.current.reminders[0].startTime).toBe("10:00");
    act(() => result.current.cancelDraft());
    expect(result.current.draft).toBeNull();
    expect(result.current.reminders[0].startTime).toBe("10:00");
  });

  it("keeps a conflicting draft open and clears committed rows explicitly", () => {
    localStorage.setItem(WORKDAY_REMINDER_STORAGE_KEY, JSON.stringify([{
      id: "meeting",
      startTime: "10:00",
      endTime: "10:30",
      statusType: "meeting",
      createdAtMs: 1,
    }]));
    const { result } = renderHook(() => useWorkdayReminders(schedule));

    act(() => result.current.startAdd());
    act(() => result.current.updateDraft({ statusType: "lunch" }));
    act(() => result.current.saveDraft());
    expect(result.current.draft?.error).toContain("冲突");
    expect(result.current.reminders).toHaveLength(1);

    act(() => result.current.cancelDraft());
    let cleared = false;
    act(() => { cleared = result.current.clearAll(); });
    expect(cleared).toBe(true);
    expect(result.current.reminders).toEqual([]);
    expect(localStorage.getItem(WORKDAY_REMINDER_STORAGE_KEY)).toBe("[]");
  });
});
