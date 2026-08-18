import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryCalendarDayTasks } from "../../../services/tauri/calendar";
import { useCalendarDayTasks } from "./useCalendarDayTasks";

vi.mock("../../../services/tauri/calendar", () => ({
  queryCalendarDayTasks: vi.fn(),
}));

describe("useCalendarDayTasks", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads tasks for the selected date once", async () => {
    vi.mocked(queryCalendarDayTasks).mockResolvedValue({
      date: "2026-08-18",
      formalTasks: [{ id: "task-1" } as never],
      overdueTasks: [],
      completedTasks: [],
      cancelledTasks: [],
    });

    const { result } = renderHook(() => useCalendarDayTasks("2026-08-18", true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(queryCalendarDayTasks).toHaveBeenCalledTimes(1);
    expect(queryCalendarDayTasks).toHaveBeenCalledWith({ date: "2026-08-18" });
    expect(result.current.dayTasks?.formalTasks).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("ignores stale responses when the date changes quickly", async () => {
    let resolveFirst: ((value: Awaited<ReturnType<typeof queryCalendarDayTasks>>) => void) | undefined;
    const firstPromise = new Promise<Awaited<ReturnType<typeof queryCalendarDayTasks>>>((resolve) => {
      resolveFirst = resolve;
    });

    vi.mocked(queryCalendarDayTasks)
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce({
        date: "2026-08-19",
        formalTasks: [{ id: "task-19" } as never],
        overdueTasks: [],
        completedTasks: [],
        cancelledTasks: [],
      });

    const { result, rerender } = renderHook(
      ({ date }: { date: string | null }) => useCalendarDayTasks(date, true),
      { initialProps: { date: "2026-08-18" } },
    );

    rerender({ date: "2026-08-19" });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    resolveFirst?.({
      date: "2026-08-18",
      formalTasks: [{ id: "task-18" } as never],
      overdueTasks: [],
      completedTasks: [],
      cancelledTasks: [],
    });

    await waitFor(() => {
      expect(result.current.dayTasks?.formalTasks[0]?.id).toBe("task-19");
    });
    expect(queryCalendarDayTasks).toHaveBeenCalledTimes(2);
  });

  it("surfaces query errors without crashing", async () => {
    vi.mocked(queryCalendarDayTasks).mockRejectedValue(new Error("ipc failed"));

    const { result } = renderHook(() => useCalendarDayTasks("2026-08-18", true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe("加载当天任务失败");
    expect(result.current.dayTasks).toBeNull();
  });
});
