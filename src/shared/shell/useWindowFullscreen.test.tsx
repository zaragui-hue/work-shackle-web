import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  useWindowFullscreen,
  type FullscreenWindow,
} from "./useWindowFullscreen";

afterEach(cleanup);

describe("useWindowFullscreen", () => {
  it("syncs native fullscreen changes and exits through the window API", async () => {
    let fullscreen = true;
    let onResize: (() => void) | undefined;
    const windowRef: FullscreenWindow = {
      isFullscreen: vi.fn(async () => fullscreen),
      onResized: vi.fn(async (handler) => {
        onResize = () => handler({} as never);
        return vi.fn();
      }),
      setFullscreen: vi.fn(async (next) => {
        fullscreen = next;
      }),
    };

    const { result } = renderHook(() => useWindowFullscreen(windowRef));
    await waitFor(() => expect(result.current.isFullscreen).toBe(true));

    fullscreen = false;
    await act(async () => onResize?.());
    await waitFor(() => expect(result.current.isFullscreen).toBe(false));

    fullscreen = true;
    await act(async () => onResize?.());
    await waitFor(() => expect(result.current.isFullscreen).toBe(true));

    await act(async () => result.current.exitFullscreen());
    expect(windowRef.setFullscreen).toHaveBeenCalledWith(false);
    expect(result.current.isFullscreen).toBe(false);
  });

  it("falls back to windowed layout when native state is unavailable", async () => {
    const windowRef: FullscreenWindow = {
      isFullscreen: vi.fn(async () => {
        throw new Error("unavailable");
      }),
      onResized: vi.fn(async () => {
        throw new Error("unavailable");
      }),
      setFullscreen: vi.fn(async () => {
        throw new Error("unavailable");
      }),
    };

    const { result } = renderHook(() => useWindowFullscreen(windowRef));
    await waitFor(() => expect(windowRef.isFullscreen).toHaveBeenCalled());
    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.exiting).toBe(false);
  });
});
