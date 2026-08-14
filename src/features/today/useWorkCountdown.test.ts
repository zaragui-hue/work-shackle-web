import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getWorkSchedule } from "../../services/tauri/settings";
import { useWorkCountdown } from "./useWorkCountdown";

vi.mock("../../services/tauri/settings", () => ({
  getWorkSchedule: vi.fn(),
  mapSettingsError: vi.fn(() => "加载失败"),
}));

const mockSchedule = {
  workDate: "2026-08-14",
  defaultStart: "09:30",
  defaultEnd: "18:00",
  effectiveStart: "09:30",
  effectiveEnd: "18:00",
  hasTodayOverride: false,
};

describe("useWorkCountdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 14, 12, 0, 0, 0));
    vi.mocked(getWorkSchedule).mockResolvedValue(mockSchedule);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("clears interval on unmount", async () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = renderHook(() => useWorkCountdown());

    await act(async () => {
      await Promise.resolve();
    });

    unmount();

    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
