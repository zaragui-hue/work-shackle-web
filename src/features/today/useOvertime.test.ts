import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  endOvertime,
  getActiveOvertime,
  startOvertime,
  type ActiveOvertime,
} from "../../services/tauri/overtime";
import { computeOvertimeDisplay } from "./overtimeDisplay";
import { useOvertime } from "./useOvertime";

vi.mock("../../services/tauri/overtime", () => ({
  getActiveOvertime: vi.fn(),
  startOvertime: vi.fn(),
  endOvertime: vi.fn(),
}));

const baseNowMs = new Date("2026-08-14T19:00:00").getTime();

const activeOvertime: ActiveOvertime = {
  id: "overtime-1",
  workDate: "2026-08-14",
  startAtMs: baseNowMs,
  autoEndAtMs: baseNowMs + 10 * 60 * 60 * 1000,
};

describe("computeOvertimeDisplay", () => {
  it("formats elapsed time from start_at_ms", () => {
    const display = computeOvertimeDisplay(1_000, 6_000);
    expect(display.elapsedText).toBe("00:00:05");
  });
});

describe("useOvertime", () => {
  beforeEach(() => {
    vi.mocked(getActiveOvertime).mockReset();
    vi.mocked(startOvertime).mockReset();
    vi.mocked(endOvertime).mockReset();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("loads active overtime on mount", async () => {
    vi.setSystemTime(baseNowMs);
    vi.mocked(getActiveOvertime).mockResolvedValue(activeOvertime);

    const { result } = renderHook(() => useOvertime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.active).toEqual(activeOvertime);
    expect(result.current.display?.elapsedText).toBe("00:00:00");
  });

  it("updates display every second without calling rust again", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(baseNowMs + 2_000);
    vi.mocked(getActiveOvertime).mockResolvedValue({
      ...activeOvertime,
      startAtMs: baseNowMs,
    });

    const { result } = renderHook(() => useOvertime());

    await act(async () => {
      await Promise.resolve();
    });

    expect(getActiveOvertime).toHaveBeenCalledTimes(1);
    expect(result.current.display?.elapsedText).toBe("00:00:02");

    await act(async () => {
      vi.advanceTimersByTime(3_000);
    });

    expect(result.current.display?.elapsedText).toBe("00:00:05");
    expect(getActiveOvertime).toHaveBeenCalledTimes(1);
  });

  it("cleans up interval on unmount", async () => {
    vi.useFakeTimers();
    vi.mocked(getActiveOvertime).mockResolvedValue(activeOvertime);
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");

    const { unmount } = renderHook(() => useOvertime());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("starts overtime and updates local state", async () => {
    vi.mocked(getActiveOvertime).mockResolvedValue(null);
    vi.mocked(startOvertime).mockResolvedValue(activeOvertime);

    const { result } = renderHook(() => useOvertime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.active).toEqual(activeOvertime);
    expect(result.current.starting).toBe(false);
  });

  it("ends overtime and clears local state", async () => {
    vi.mocked(getActiveOvertime).mockResolvedValue(activeOvertime);
    vi.mocked(endOvertime).mockResolvedValue(undefined);

    const { result } = renderHook(() => useOvertime());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await act(async () => {
      await result.current.end();
    });

    expect(result.current.active).toBeNull();
    expect(result.current.display).toBeNull();
    expect(result.current.ending).toBe(false);
  });
});
