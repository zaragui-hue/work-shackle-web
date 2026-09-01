import { describe, expect, it } from "vitest";

import type { WorkSchedule } from "../../services/tauri/settings";
import {
  DEFAULT_WORKDAY_REMINDERS,
  LEGACY_WORKDAY_REMINDER_STORAGE_KEY,
  V2_WORKDAY_REMINDER_STORAGE_KEY,
  WORKDAY_REMINDER_STORAGE_KEY,
  createWorkdayReminder,
  findActiveWorkdayReminder,
  loadWorkdayReminders,
  sortWorkdayReminders,
  validateWorkdayReminder,
  type WorkdayReminder,
} from "./workdayReminders";

const schedule: WorkSchedule = {
  workDate: "2026-08-21",
  defaultStart: "09:00",
  defaultEnd: "18:00",
  effectiveStart: "09:00",
  effectiveEnd: "18:00",
  hasTodayOverride: false,
};

function reminder(
  id: string,
  startTime: string,
  endTime: string,
): WorkdayReminder {
  return {
    id,
    startTime,
    endTime,
    statusType: "meeting",
    createdAtMs: Number(id.replace(/\D/g, "")) || 1,
  };
}

describe("workday reminder ranges", () => {
  it("uses range defaults when storage is empty", () => {
    expect(loadWorkdayReminders(new MemoryStorage())).toEqual(DEFAULT_WORKDAY_REMINDERS);
  });

  it("creates an unsaved draft at the next whole hour for 30 minutes", () => {
    const draft = createWorkdayReminder(new Date(2026, 7, 21, 9, 12).getTime());
    expect(draft).toMatchObject({
      startTime: "10:00",
      endTime: "10:30",
      statusType: null,
    });
  });

  it("validates schedule bounds, overlap, and touching ranges", () => {
    const existing = reminder("r1", "10:00", "10:30");
    expect(validateWorkdayReminder(reminder("r2", "10:15", "10:45"), [existing], schedule))
      .toContain("冲突");
    expect(validateWorkdayReminder(reminder("r2", "10:30", "11:00"), [existing], schedule))
      .toBeNull();
    expect(validateWorkdayReminder(reminder("r3", "08:30", "09:30"), [], schedule))
      .toContain("排班");
    expect(validateWorkdayReminder(reminder("r4", "11:00", "10:00"), [], schedule))
      .toContain("晚于");
  });

  it("sorts by start, end, and creation order", () => {
    const rows = [
      reminder("r3", "14:00", "15:00"),
      reminder("r2", "10:00", "11:00"),
      reminder("r1", "10:00", "10:30"),
    ];
    expect(sortWorkdayReminders(rows).map((row) => row.id)).toEqual(["r1", "r2", "r3"]);
  });

  it("finds a range when the app opens in the middle of it", () => {
    const active = findActiveWorkdayReminder({
      reminders: [reminder("r1", "14:00", "15:00")],
      workDate: schedule.workDate,
      nowMs: new Date(2026, 7, 21, 14, 37).getTime(),
    });
    expect(active?.id).toBe("r1");

    expect(findActiveWorkdayReminder({
      reminders: [reminder("r1", "14:00", "15:00")],
      workDate: schedule.workDate,
      nowMs: new Date(2026, 7, 21, 15, 0).getTime(),
    })).toBeNull();
  });

  it("migrates supported v1 reminders and drops automatic statuses", () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_WORKDAY_REMINDER_STORAGE_KEY, JSON.stringify([
      { id: "meeting", time: "14:00", suggestedStatus: "meeting", enabled: true },
      { id: "working", time: "10:00", suggestedStatus: "working", enabled: true },
      { id: "leave", time: "17:30", suggestedStatus: "preparing_leave", enabled: true },
    ]));

    expect(loadWorkdayReminders(storage, schedule)).toEqual([
      expect.objectContaining({
        id: "meeting",
        startTime: "14:00",
        endTime: "14:30",
        statusType: "meeting",
      }),
    ]);
    expect(storage.getItem(WORKDAY_REMINDER_STORAGE_KEY)).toContain("meeting");
  });

  it("migrates only enabled v2 rows and keeps a cleared v3 list empty", () => {
    const storage = new MemoryStorage();
    storage.setItem(V2_WORKDAY_REMINDER_STORAGE_KEY, JSON.stringify([
      {
        id: "kept",
        startTime: "10:00",
        endTime: "10:30",
        statusType: "meeting",
        enabled: true,
        createdAtMs: 1,
      },
      {
        id: "draft",
        startTime: "11:00",
        endTime: "11:30",
        statusType: "lunch",
        enabled: false,
        createdAtMs: 2,
      },
    ]));

    expect(loadWorkdayReminders(storage, schedule).map((row) => row.id)).toEqual(["kept"]);
    storage.setItem(WORKDAY_REMINDER_STORAGE_KEY, "[]");
    expect(loadWorkdayReminders(storage, { ...schedule, workDate: "2026-08-22" })).toEqual([]);
  });
});

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}
