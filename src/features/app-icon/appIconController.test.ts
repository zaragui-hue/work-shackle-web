import { describe, expect, it, vi } from "vitest";

import { applyDynamicAppIcon } from "./appIconController";

describe("applyDynamicAppIcon", () => {
  it("loads the PNG and passes bytes to the native app icon command", async () => {
    const invokeCommand = vi.fn(async () => undefined);
    const fetcher = vi.fn(async () => (
      new Response(new Uint8Array([137, 80, 78, 71]))
    ));

    await applyDynamicAppIcon("default", invokeCommand, fetcher);

    expect(invokeCommand).toHaveBeenCalledWith("set_dynamic_app_icon", {
      iconBytes: [137, 80, 78, 71],
    });
  });

  it("rejects failed asset loads without calling the native command", async () => {
    const invokeCommand = vi.fn(async () => undefined);
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));

    await expect(
      applyDynamicAppIcon("morning", invokeCommand, fetcher),
    ).rejects.toThrow("dynamic icon asset unavailable");
    expect(invokeCommand).not.toHaveBeenCalled();
  });
});
