import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DYNAMIC_APP_ICON_REFRESH_EVENT,
} from "../../services/tauri/dynamicAppIconEvents";
import {
  useDynamicAppIcon,
  type DynamicAppIconRuntime,
} from "./useDynamicAppIcon";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function runtime(): DynamicAppIconRuntime {
  return {
    enabled: true,
    now: () => new Date(2026, 7, 31, 10, 0).getTime(),
    loadSnapshot: vi.fn(async (nowMs) => ({ nowMs })),
    applyIcon: vi.fn(async () => undefined),
    onFocus: vi.fn(async () => vi.fn()),
    onTaskChanged: vi.fn(async () => vi.fn()),
  };
}

describe("useDynamicAppIcon", () => {
  it("applies on mount, refreshes on request, and deduplicates one state", async () => {
    const deps = runtime();
    renderHook(() => useDynamicAppIcon(null, deps));

    await waitFor(() => expect(deps.applyIcon).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new Event(DYNAMIC_APP_ICON_REFRESH_EVENT)));
    await waitFor(() => expect(deps.loadSnapshot).toHaveBeenCalledTimes(2));
    expect(deps.applyIcon).toHaveBeenCalledTimes(1);
  });

  it("retries a state after the previous native application failed", async () => {
    const deps = runtime();
    vi.mocked(deps.applyIcon).mockRejectedValueOnce(new Error("native failure"));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    renderHook(() => useDynamicAppIcon(null, deps));

    await waitFor(() => expect(deps.applyIcon).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new Event(DYNAMIC_APP_ICON_REFRESH_EVENT)));
    await waitFor(() => expect(deps.applyIcon).toHaveBeenCalledTimes(2));
  });

  it("does nothing in web mode", () => {
    const deps = { ...runtime(), enabled: false };
    renderHook(() => useDynamicAppIcon(null, deps));
    expect(deps.loadSnapshot).not.toHaveBeenCalled();
  });

  it("refreshes after native focus or a reminder task change", async () => {
    const deps = runtime();
    let focusHandler: (() => void) | undefined;
    let taskHandler: (() => void) | undefined;
    deps.onFocus = vi.fn(async (handler) => {
      focusHandler = handler;
      return vi.fn();
    });
    deps.onTaskChanged = vi.fn(async (handler) => {
      taskHandler = handler;
      return vi.fn();
    });
    renderHook(() => useDynamicAppIcon(null, deps));

    await waitFor(() => expect(deps.loadSnapshot).toHaveBeenCalledTimes(1));
    act(() => focusHandler?.());
    await waitFor(() => expect(deps.loadSnapshot).toHaveBeenCalledTimes(2));
    act(() => taskHandler?.());
    await waitFor(() => expect(deps.loadSnapshot).toHaveBeenCalledTimes(3));
  });

  it("aligns recurring refresh to the next minute boundary", async () => {
    vi.useFakeTimers();
    const deps = runtime();
    deps.now = () => new Date(2026, 7, 31, 10, 0, 30).getTime();
    renderHook(() => useDynamicAppIcon(null, deps));

    await act(async () => { await Promise.resolve(); });
    expect(deps.loadSnapshot).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(deps.loadSnapshot).toHaveBeenCalledTimes(2);
  });
});
