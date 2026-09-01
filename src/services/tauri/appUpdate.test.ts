import { describe, expect, it, vi } from "vitest";

import { createAppUpdateClient } from "./appUpdate";

describe("app update client", () => {
  it("returns null outside the Tauri runtime", async () => {
    const client = createAppUpdateClient({ isTauri: () => false });

    await expect(client.check()).resolves.toBeNull();
  });

  it("maps update metadata, progress, installation, and relaunch", async () => {
    const downloadAndInstall = vi.fn(async (listener) => {
      listener({ event: "Started", data: { contentLength: 100 } });
      listener({ event: "Progress", data: { chunkLength: 40 } });
      listener({ event: "Finished" });
    });
    const check = vi.fn(async () => ({
      version: "0.1.2",
      body: "Fixes",
      date: "2026-08-31T00:00:00Z",
      downloadAndInstall,
    }));
    const relaunch = vi.fn(async () => undefined);
    const client = createAppUpdateClient({
      isTauri: () => true,
      loadBindings: async () => ({ check, relaunch }),
    });

    const update = await client.check();
    const progress = vi.fn();
    await update?.downloadAndInstall(progress);
    await client.relaunch();

    expect(update).toMatchObject({
      version: "0.1.2",
      body: "Fixes",
      date: "2026-08-31T00:00:00Z",
    });
    expect(progress).toHaveBeenNthCalledWith(1, {
      phase: "downloading",
      downloaded: 0,
      total: 100,
    });
    expect(progress).toHaveBeenNthCalledWith(2, {
      phase: "downloading",
      downloaded: 40,
      total: 100,
    });
    expect(progress).toHaveBeenLastCalledWith({ phase: "installing" });
    expect(relaunch).toHaveBeenCalledTimes(1);
  });
});
