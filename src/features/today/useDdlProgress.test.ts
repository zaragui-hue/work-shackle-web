import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeDdlProgress } from "../../services/tauri/ddl";
import { DDL_PROGRESS_REFRESH_MS, useDdlProgress } from "./useDdlProgress";

vi.mock("../../services/tauri/ddl", () => ({
  computeDdlProgress: vi.fn(),
}));

const plannedAtMs = 1_000_000;
const deadlineAtMs = 1_010_000;

const rustProgress = {
  progressRatio: 0.4,
  remainingMs: 6_000,
  isOverdue: false,
  emotion: "calm" as const,
};

describe("useDdlProgress", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 17, 12, 0, 0, 0));
    vi.mocked(computeDdlProgress).mockResolvedValue(rustProgress);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("does not query Rust when deadline is missing", async () => {
    const { result } = renderHook(() => useDdlProgress(plannedAtMs, undefined));

    await act(async () => {
      await Promise.resolve();
    });

    expect(computeDdlProgress).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it("does not query Rust for an invalid interval", async () => {
    const { result } = renderHook(() => useDdlProgress(deadlineAtMs, plannedAtMs));

    await act(async () => {
      await Promise.resolve();
    });

    expect(computeDdlProgress).not.toHaveBeenCalled();
    expect(result.current).toBeNull();
  });

  it("exposes Rust progress for a valid interval", async () => {
    const { result } = renderHook(() =>
      useDdlProgress(plannedAtMs, deadlineAtMs),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(computeDdlProgress).toHaveBeenCalledWith({
      plannedAtMs,
      deadlineAtMs,
      nowMs: Date.now(),
    });
    expect(result.current).toEqual(rustProgress);
  });

  it("refreshes through Rust on the display interval, not every second", async () => {
    renderHook(() => useDdlProgress(plannedAtMs, deadlineAtMs));

    await act(async () => {
      await Promise.resolve();
    });

    expect(computeDdlProgress).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(1_000);
      await Promise.resolve();
    });

    expect(computeDdlProgress).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(DDL_PROGRESS_REFRESH_MS);
      await Promise.resolve();
    });

    expect(computeDdlProgress).toHaveBeenCalledTimes(2);
  });

  it("hides progress when Rust rejects an invalid interval", async () => {
    vi.mocked(computeDdlProgress).mockRejectedValue({
      code: "INVALID_DEADLINE",
      details: { message: "deadline must be after planned time" },
    });

    const { result } = renderHook(() =>
      useDdlProgress(plannedAtMs, deadlineAtMs),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current).toBeNull();
  });
});
