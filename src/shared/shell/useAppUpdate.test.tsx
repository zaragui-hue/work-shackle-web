import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type {
  AppUpdateCandidate,
  AppUpdateClient,
  AppUpdateProgress,
} from "../../services/tauri/appUpdate";
import { useAppUpdate } from "./useAppUpdate";

afterEach(cleanup);

function candidate(
  downloadAndInstall: AppUpdateCandidate["downloadAndInstall"] = vi.fn(
    async () => undefined,
  ),
): AppUpdateCandidate {
  return {
    version: "0.1.2",
    body: "修复窗口边缘",
    date: null,
    downloadAndInstall,
  };
}

describe("useAppUpdate", () => {
  it("checks once on mount and stays quiet when the app is current", async () => {
    const client: AppUpdateClient = {
      check: vi.fn(async () => null),
      relaunch: vi.fn(async () => undefined),
    };

    const { result } = renderHook(() => useAppUpdate(client));

    await waitFor(() => expect(result.current.state.status).toBe("current"));
    expect(client.check).toHaveBeenCalledTimes(1);
  });

  it("downloads once, reports progress, installs, and relaunches", async () => {
    let finishDownload: (() => void) | undefined;
    const downloadAndInstall = vi.fn(
      async (onProgress: (event: AppUpdateProgress) => void) => {
        onProgress({ phase: "downloading", downloaded: 50, total: 100 });
        await new Promise<void>((resolve) => {
          finishDownload = resolve;
        });
        onProgress({ phase: "installing" });
      },
    );
    const update = candidate(downloadAndInstall);
    const client: AppUpdateClient = {
      check: vi.fn(async () => update),
      relaunch: vi.fn(async () => undefined),
    };

    const { result } = renderHook(() => useAppUpdate(client));
    await waitFor(() => expect(result.current.state.status).toBe("available"));

    act(() => {
      void result.current.activate();
    });
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: "downloading",
        progress: 50,
      }),
    );

    await act(async () => result.current.activate());
    expect(downloadAndInstall).toHaveBeenCalledTimes(1);

    await act(async () => finishDownload?.());
    await waitFor(() => expect(client.relaunch).toHaveBeenCalledTimes(1));
  });

  it("retries a failed update check", async () => {
    const check = vi
      .fn<AppUpdateClient["check"]>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(null);
    const client: AppUpdateClient = {
      check,
      relaunch: vi.fn(async () => undefined),
    };

    const { result } = renderHook(() => useAppUpdate(client));
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: "failed",
        retry: "check",
      }),
    );

    await act(async () => result.current.activate());
    await waitFor(() => expect(result.current.state.status).toBe("current"));
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("retries installation without checking the release again", async () => {
    const downloadAndInstall = vi
      .fn<AppUpdateCandidate["downloadAndInstall"]>()
      .mockRejectedValueOnce(new Error("install failed"))
      .mockResolvedValueOnce(undefined);
    const update = candidate(downloadAndInstall);
    const client: AppUpdateClient = {
      check: vi.fn(async () => update),
      relaunch: vi.fn(async () => undefined),
    };

    const { result } = renderHook(() => useAppUpdate(client));
    await waitFor(() => expect(result.current.state.status).toBe("available"));

    await act(async () => result.current.activate());
    expect(result.current.state).toMatchObject({
      status: "failed",
      retry: "install",
    });

    await act(async () => result.current.activate());
    expect(downloadAndInstall).toHaveBeenCalledTimes(2);
    expect(client.check).toHaveBeenCalledTimes(1);
    expect(client.relaunch).toHaveBeenCalledTimes(1);
  });
});
