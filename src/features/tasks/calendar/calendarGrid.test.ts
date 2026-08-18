import { addMonths, startOfMonth, subMonths } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  areCalendarCellsContiguous,
  buildCalendarGrid,
  formatCalendarDayDrawerTitle,
  formatCalendarMonthTitle,
  getCalendarGridDateRange,
  isMondayFirstGrid,
  toLocalDateKey,
} from "./calendarGrid";

function month(year: number, monthIndex: number): Date {
  return new Date(year, monthIndex, 1);
}

describe("buildCalendarGrid", () => {
  const today = new Date(2026, 7, 18);

  it("starts on Monday when the month begins on Monday", () => {
    const cells = buildCalendarGrid(month(2026, 5), today);

    expect(cells[0].dateKey).toBe("2026-06-01");
    expect(cells[0].dayNumber).toBe(1);
    expect(isMondayFirstGrid(cells)).toBe(true);
  });

  it("pads leading days when the month starts mid-week", () => {
    const cells = buildCalendarGrid(month(2026, 7), today);

    expect(cells[0].dateKey).toBe("2026-07-27");
    expect(cells[0].isCurrentMonth).toBe(false);
    expect(cells.find((cell) => cell.dateKey === "2026-08-01")?.isCurrentMonth).toBe(
      true,
    );
    expect(isMondayFirstGrid(cells)).toBe(true);
  });

  it("pads trailing days through the end of the week", () => {
    const cells = buildCalendarGrid(month(2026, 7), today);
    const lastCell = cells[cells.length - 1];

    expect(lastCell.dateKey).toBe("2026-09-06");
    expect(lastCell.isCurrentMonth).toBe(false);
    expect(lastCell.date.getDay()).toBe(0);
  });

  it("includes adjacent months in one continuous grid", () => {
    const cells = buildCalendarGrid(month(2026, 7), today);
    const keys = cells.map((cell) => cell.dateKey);

    expect(keys).toContain("2026-07-31");
    expect(keys).toContain("2026-08-15");
    expect(keys).toContain("2026-09-01");
  });

  it("handles December to January boundaries", () => {
    const december = buildCalendarGrid(month(2025, 11), today);
    const january = buildCalendarGrid(month(2026, 0), today);

    expect(december.some((cell) => cell.dateKey === "2026-01-04")).toBe(true);
    expect(january.some((cell) => cell.dateKey === "2025-12-29")).toBe(true);
    expect(january.some((cell) => cell.dateKey === "2026-02-01")).toBe(true);
  });

  it("keeps Monday-first ordering", () => {
    for (const sample of [month(2026, 0), month(2026, 7), month(2026, 11)]) {
      expect(isMondayFirstGrid(buildCalendarGrid(sample, today))).toBe(true);
    }
  });

  it("marks today within the visible month", () => {
    const cells = buildCalendarGrid(month(2026, 7), today);
    const todayCell = cells.find((cell) => cell.isToday);

    expect(todayCell?.dateKey).toBe("2026-08-18");
    expect(todayCell?.isCurrentMonth).toBe(true);
  });

  it("marks current-month cells separately from padding days", () => {
    const cells = buildCalendarGrid(month(2026, 7), today);

    expect(cells.filter((cell) => cell.isCurrentMonth)).toHaveLength(31);
    expect(cells.filter((cell) => !cell.isCurrentMonth).length).toBeGreaterThan(0);
  });

  it("returns unique, contiguous dates in rows of seven", () => {
    const cells = buildCalendarGrid(month(2026, 7), today);
    const keys = cells.map((cell) => cell.dateKey);

    expect(new Set(keys).size).toBe(keys.length);
    expect(areCalendarCellsContiguous(cells)).toBe(true);
    expect(cells.length % 7).toBe(0);
  });

  it("uses local date keys rather than UTC strings", () => {
    const localDate = new Date(2026, 7, 18, 23, 30, 0);
    expect(toLocalDateKey(localDate)).toBe("2026-08-18");
  });
});

describe("formatCalendarMonthTitle", () => {
  it("formats the visible month title", () => {
    expect(formatCalendarMonthTitle(month(2026, 7))).toBe("2026 年 8 月");
  });
});

describe("formatCalendarDayDrawerTitle", () => {
  it("formats the drawer title with month, day and count", () => {
    expect(formatCalendarDayDrawerTitle("2026-08-18", 5)).toBe("8 月 18 日 · 5 个任务");
  });
});

describe("getCalendarGridDateRange", () => {
  it("returns the first and last visible grid dates", () => {
    const cells = buildCalendarGrid(month(2026, 7), new Date(2026, 7, 18));
    expect(getCalendarGridDateRange(cells)).toEqual({
      startDate: "2026-07-27",
      endDate: "2026-09-06",
    });
  });
});

describe("calendar month navigation helpers", () => {
  it("moves across month and year boundaries", () => {
    const december = month(2025, 11);
    const next = addMonths(december, 1);
    const previous = subMonths(december, 1);

    expect(startOfMonth(next).getMonth()).toBe(0);
    expect(startOfMonth(next).getFullYear()).toBe(2026);
    expect(startOfMonth(previous).getMonth()).toBe(10);
    expect(startOfMonth(previous).getFullYear()).toBe(2025);
  });
});
