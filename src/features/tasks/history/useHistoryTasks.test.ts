import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { queryHistoryTasks } from "../../../services/tauri/tasks";
import { useHistoryTasks } from "./useHistoryTasks";

vi.mock("../../../services/tauri/tasks", () => ({
  mapTaskError: () => "历史任务查询失败",
  queryHistoryTasks: vi.fn(),
}));

const DAY_QUERY = {
  mode: "day" as const,
  anchorDate: "2026-08-18",
  status: "completed" as const,
  priority: 5,
  keyword: "report",
};

describe("useHistoryTasks", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("loads history tasks for the selected query", async () => {
    vi.mocked(queryHistoryTasks).mockResolvedValue([{ id: "task-1" } as never]);

    const { result } = renderHook(() => useHistoryTasks(DAY_QUERY, true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(queryHistoryTasks).toHaveBeenCalledWith(DAY_QUERY);
    expect(result.current.tasks).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("ignores stale responses when the query changes quickly", async () => {
    let resolveFirst: ((value: Awaited<ReturnType<typeof queryHistoryTasks>>) => void) | undefined;
    const firstPromise = new Promise<Awaited<ReturnType<typeof queryHistoryTasks>>>((resolve) => {
      resolveFirst = resolve;
    });
    let callCount = 0;

    vi.mocked(queryHistoryTasks).mockImplementation(() => {
      callCount += 1;
      if (callCount === 1) {
        return firstPromise;
      }
      return Promise.resolve([{ id: "task-week" } as never]);
    });

    const { result, rerender } = renderHook(
      ({ query }: { query: { mode: "day" | "week"; anchorDate: string } }) =>
        useHistoryTasks(query, true),
      { initialProps: { query: { mode: "day", anchorDate: "2026-08-18" } } },
    );

    rerender({ query: { mode: "week", anchorDate: "2026-08-18" } });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tasks[0]?.id).toBe("task-week");

    resolveFirst?.([{ id: "task-day" } as never]);

    await waitFor(() => {
      expect(result.current.tasks[0]?.id).toBe("task-week");
    });
    expect(queryHistoryTasks).toHaveBeenCalledTimes(2);
  });

  it("surfaces query errors without crashing", async () => {
    vi.mocked(queryHistoryTasks).mockRejectedValue({ code: "DATABASE_ERROR" });

    const { result } = renderHook(() => useHistoryTasks(DAY_QUERY, true));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.tasks).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });
});
