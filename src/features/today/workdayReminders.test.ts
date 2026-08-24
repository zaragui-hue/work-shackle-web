import { describe, expect, it } from "vitest";

import {
  DEFAULT_WORKDAY_REMINDERS,
  findDueWorkdayReminder,
  loadWorkdayReminders,
} from "./workdayReminders";

describe("workday reminders", () => {
  it("uses the worker-friendly defaults when storage is empty", () => {
    const storage = new MemoryStorage();
    expect(loadWorkdayReminders(storage)).toEqual(DEFAULT_WORKDAY_REMINDERS);
  });

  it("finds only a due, enabled and unhandled reminder in the grace window", () => {
    const due = findDueWorkdayReminder({
      reminders: DEFAULT_WORKDAY_REMINDERS,
      workDate: "2026-08-21",
      nowMs: new Date(2026, 7, 21, 12, 2).getTime(),
      handledIds: new Set(),
    });
    expect(due?.id).toBe("lunch-1200");

    const handled = findDueWorkdayReminder({
      reminders: DEFAULT_WORKDAY_REMINDERS,
      workDate: "2026-08-21",
      nowMs: new Date(2026, 7, 21, 12, 2).getTime(),
      handledIds: new Set(["lunch-1200"]),
    });
    expect(handled).toBeNull();
  });

  it("does not dump stale reminders when the app opens much later", () => {
    const due = findDueWorkdayReminder({
      reminders: DEFAULT_WORKDAY_REMINDERS,
      workDate: "2026-08-21",
      nowMs: new Date(2026, 7, 21, 18, 0).getTime(),
      handledIds: new Set(),
    });
    expect(due).toBeNull();
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
