import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCalendarDayRefresh } from "./useCalendarDayRefresh";

describe("useCalendarDayRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 23, 59, 59));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("refreshes at each local midnight", () => {
    const refresh = vi.fn();
    renderHook(() => useCalendarDayRefresh(refresh));

    act(() => vi.advanceTimersByTime(1_000));
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes when the window regains focus", () => {
    const refresh = vi.fn();
    renderHook(() => useCalendarDayRefresh(refresh));

    act(() => window.dispatchEvent(new Event("focus")));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the document becomes visible", () => {
    const refresh = vi.fn();
    renderHook(() => useCalendarDayRefresh(refresh));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("cleans up timers and listeners on unmount", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useCalendarDayRefresh(refresh));
    unmount();

    act(() => {
      vi.advanceTimersByTime(1_000);
      window.dispatchEvent(new Event("focus"));
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
