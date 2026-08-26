import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useTaskPressure } from "./useTaskPressure";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useTaskPressure", () => {
  it("refreshes the shared percentage every second", () => {
    vi.useFakeTimers();
    vi.setSystemTime(500);
    const { result } = renderHook(() => useTaskPressure(0, 2_500));

    expect(result.current.percentLabel).toBe("20%");

    act(() => {
      vi.setSystemTime(800);
      vi.advanceTimersByTime(1_000);
    });

    expect(result.current.percentLabel).toBe("72%");
    expect(result.current.emotion).toBe("anxious");
  });

  it("does not start a timer for an invalid interval", () => {
    vi.useFakeTimers();
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    const { result } = renderHook(() => useTaskPressure(1_000, 1_000));

    expect(result.current.valid).toBe(false);
    expect(setIntervalSpy).not.toHaveBeenCalled();
  });
});
