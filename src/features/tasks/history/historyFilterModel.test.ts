import { describe, expect, it } from "vitest";

import {
  createDefaultHistoryFilter,
  formatHistoryPeriodLabel,
  hasActiveBusinessFilters,
  shiftHistoryAnchor,
  toHistoryTasksQuery,
  validateCustomRange,
} from "./historyFilterModel";

describe("historyTimeFilter", () => {
  it("defaults to day mode with today anchor", () => {
    const filter = createDefaultHistoryFilter(new Date(2026, 7, 18));
    expect(filter.mode).toBe("day");
    expect(filter.anchorDate).toBe("2026-08-18");
    expect(filter.keyword).toBe("");
  });

  it("builds anchored query payloads for non-custom modes", () => {
    const filter = createDefaultHistoryFilter(new Date(2026, 7, 18));
    expect(toHistoryTasksQuery({ ...filter, mode: "week" })).toEqual({
      mode: "week",
      anchorDate: "2026-08-18",
    });
  });

  it("builds custom query payloads", () => {
    expect(
      toHistoryTasksQuery({
        mode: "custom",
        anchorDate: "2026-08-18",
        customStartDate: "2026-08-10",
        customEndDate: "2026-08-12",
        keyword: "",
      }),
    ).toEqual({
      mode: "custom",
      startDate: "2026-08-10",
      endDate: "2026-08-12",
    });
  });

  it("includes active business filters in query payloads", () => {
    const filter = createDefaultHistoryFilter(new Date(2026, 7, 18));
    expect(
      toHistoryTasksQuery({
        ...filter,
        status: "completed",
        priority: 4,
        contactId: "contact-1",
        keyword: "  report  ",
      }),
    ).toEqual({
      mode: "day",
      anchorDate: "2026-08-18",
      status: "completed",
      priority: 4,
      contactId: "contact-1",
      keyword: "report",
    });
  });

  it("treats blank keyword as no filter", () => {
    const filter = createDefaultHistoryFilter(new Date(2026, 7, 18));
    expect(toHistoryTasksQuery({ ...filter, keyword: "   " })).toEqual({
      mode: "day",
      anchorDate: "2026-08-18",
    });
  });

  it("detects active business filters", () => {
    const filter = createDefaultHistoryFilter(new Date(2026, 7, 18));
    expect(hasActiveBusinessFilters(filter)).toBe(false);
    expect(hasActiveBusinessFilters({ ...filter, keyword: "alpha" })).toBe(true);
    expect(hasActiveBusinessFilters({ ...filter, status: "cancelled" })).toBe(true);
  });

  it("rejects custom ranges where start is after end", () => {
    expect(validateCustomRange("2026-08-20", "2026-08-18")).toMatch(/开始日期/);
  });

  it("allows custom single-day ranges", () => {
    expect(validateCustomRange("2026-08-18", "2026-08-18")).toBeNull();
  });

  it("shifts day anchors by one day", () => {
    const filter = createDefaultHistoryFilter(new Date(2026, 7, 18));
    const next = shiftHistoryAnchor(filter, 1);
    expect(next.anchorDate).toBe("2026-08-19");
  });

  it("formats week labels with monday-first range", () => {
    const label = formatHistoryPeriodLabel({
      mode: "week",
      anchorDate: "2026-09-01",
      customStartDate: "2026-09-01",
      customEndDate: "2026-09-01",
      keyword: "",
    });
    expect(label).toContain("2026年8月31日");
    expect(label).toContain("9月6日");
  });
});
