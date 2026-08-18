import { describe, expect, it } from "vitest";

import { formatCalendarCellAriaLabel } from "./calendarDayMeta";
import { DEFAULT_BUSY_LEVELS } from "./busyLevel";

describe("calendarDayMeta", () => {
  it("hides task details in aria label when count is zero", () => {
    const label = formatCalendarCellAriaLabel({
      dateLabel: "2026年8月18日",
      taskCount: 0,
      busyLevel: DEFAULT_BUSY_LEVELS[0],
      holidayName: null,
      isWeekend: false,
      isCurrentMonth: true,
    });

    expect(label).toBe("2026年8月18日");
    expect(label).not.toContain("0 个任务");
  });

  it("includes weekend marker for weekend days without tasks", () => {
    const label = formatCalendarCellAriaLabel({
      dateLabel: "2026年8月1日",
      taskCount: 0,
      busyLevel: DEFAULT_BUSY_LEVELS[0],
      holidayName: null,
      isWeekend: true,
      isCurrentMonth: true,
    });

    expect(label).toContain("周末");
  });

  it("includes holiday marker for statutory holidays", () => {
    const label = formatCalendarCellAriaLabel({
      dateLabel: "2026年10月1日",
      taskCount: 0,
      busyLevel: DEFAULT_BUSY_LEVELS[0],
      holidayName: "国庆",
      isWeekend: false,
      isCurrentMonth: true,
    });

    expect(label).toContain("节假日：国庆");
  });
});
