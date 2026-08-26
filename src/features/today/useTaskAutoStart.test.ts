import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Task } from "../../services/tauri/tasks";
import { useTaskAutoStart } from "./useTaskAutoStart";

function task(id: string, plannedAtMs: number, status: Task["status"]): Task {
  return {
    id,
    title: id,
    plannedAtMs,
    priority: 2,
    status,
    createdAtMs: plannedAtMs - 1_000,
    updatedAtMs: plannedAtMs - 1_000,
  };
}

describe("useTaskAutoStart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("refreshes once at the nearest future not-started task", () => {
    const refresh = vi.fn();
    renderHook(() =>
      useTaskAutoStart(
        [
          task("later", 15_000, "not_started"),
          task("next", 12_000, "not_started"),
          task("manual", 11_000, "paused"),
        ],
        refresh,
      ),
    );

    act(() => vi.advanceTimersByTime(1_999));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("clears the previous timer when task times change or the hook unmounts", () => {
    const refresh = vi.fn();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { rerender, unmount } = renderHook(
      ({ tasks }: { tasks: Task[] }) => useTaskAutoStart(tasks, refresh),
      {
        initialProps: {
          tasks: [task("first", 12_000, "not_started")],
        },
      },
    );

    rerender({ tasks: [task("replacement", 14_000, "not_started")] });
    act(() => vi.advanceTimersByTime(2_000));
    expect(refresh).not.toHaveBeenCalled();

    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it("does not schedule terminal, manual, or already-due tasks", () => {
    const refresh = vi.fn();
    renderHook(() =>
      useTaskAutoStart(
        [
          task("due", 9_000, "not_started"),
          task("waiting", 12_000, "waiting"),
          task("done", 13_000, "completed"),
        ],
        refresh,
      ),
    );

    act(() => vi.runAllTimers());
    expect(refresh).not.toHaveBeenCalled();
  });
});
