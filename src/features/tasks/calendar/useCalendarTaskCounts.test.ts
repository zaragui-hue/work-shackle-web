import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryCalendarTaskCounts } from "../../../services/tauri/calendar";
import { useCalendarTaskCounts } from "./useCalendarTaskCounts";

vi.mock("../../../services/tauri/calendar", () => ({
  queryCalendarTaskCounts: vi.fn(),
  calendarTaskCountsToMap: (entries: { date: string; taskCount: number }[]) =>
    Object.fromEntries(entries.map((entry) => [entry.date, entry.taskCount])),
}));

describe("useCalendarTaskCounts", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads counts for the requested date range once", async () => {
    vi.mocked(queryCalendarTaskCounts).mockResolvedValue([
      { date: "2026-08-18", taskCount: 2 },
      { date: "2026-08-19", taskCount: 0 },
    ]);

    const { result } = renderHook(() =>
      useCalendarTaskCounts("2026-08-01", "2026-08-31"),
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(queryCalendarTaskCounts).toHaveBeenCalledTimes(1);
    expect(queryCalendarTaskCounts).toHaveBeenCalledWith({
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
    expect(result.current.countsByDate["2026-08-18"]).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it("clears counts when the range is unavailable", async () => {
    vi.mocked(queryCalendarTaskCounts).mockResolvedValue([
      { date: "2026-08-18", taskCount: 1 },
    ]);

    const { result, rerender } = renderHook(
      ({ startDate, endDate }: { startDate: string | null; endDate: string | null }) =>
        useCalendarTaskCounts(startDate, endDate),
      {
        initialProps: { startDate: "2026-08-01", endDate: "2026-08-31" },
      },
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    rerender({ startDate: null, endDate: null });

    expect(result.current.countsByDate).toEqual({});
    expect(queryCalendarTaskCounts).toHaveBeenCalledTimes(1);
  });
});
