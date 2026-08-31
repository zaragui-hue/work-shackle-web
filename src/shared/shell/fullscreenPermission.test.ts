import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Capability = {
  windows: string[];
  permissions: string[];
};

describe("fullscreen window permission", () => {
  it("allows the main window to exit native fullscreen", () => {
    const capability = JSON.parse(
      readFileSync(
        join(process.cwd(), "src-tauri/capabilities/fullscreen.json"),
        "utf8",
      ),
    ) as Capability;

    expect(capability.windows).toEqual(["main"]);
    expect(capability.permissions).toContain(
      "core:window:allow-set-fullscreen",
    );
  });
});
