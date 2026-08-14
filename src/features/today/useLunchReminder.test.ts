import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { checkLunchReminder } from "../../services/tauri/lunchReminder";
import { useLunchReminder } from "./useLunchReminder";

vi.mock("../../services/tauri/lunchReminder", () => ({
  checkLunchReminder: vi.fn(),
}));

const mockReminder = {
  message: "到饭点了。工作可以等等，饭凉了是真的不好吃。",
  reminderDate: "2026-08-14",
  lunchStart: "12:00",
  lunchEnd: "13:00",
};

describe("useLunchReminder", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(checkLunchReminder).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("clears interval on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = renderHook(() => useLunchReminder());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });

  it("does not create overlapping polls while a request is in flight", async () => {
    let resolvePoll: ((value: null) => void) | undefined;
    vi.mocked(checkLunchReminder).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePoll = resolve;
        }),
    );

    renderHook(() => useLunchReminder());

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });

    expect(checkLunchReminder).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolvePoll?.(null);
      await Promise.resolve();
    });
  });

  it("shows reminder returned from Rust and allows dismiss", async () => {
    vi.mocked(checkLunchReminder).mockResolvedValue(mockReminder);

    const { result } = renderHook(() => useLunchReminder());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.reminder).toEqual(mockReminder);
    expect(result.current.dismissed).toBe(false);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.dismissed).toBe(true);
  });
});
