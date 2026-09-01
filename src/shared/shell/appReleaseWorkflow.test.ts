import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("desktop release workflow", () => {
  it("publishes signed macOS arm64 and Windows x64 updates from version tags", () => {
    const workflow = readFileSync(
      join(process.cwd(), ".github/workflows/release.yml"),
      "utf8",
    );

    expect(workflow).toContain('tags:\n      - "v*"');
    expect(workflow).toContain("macos-14");
    expect(workflow).toContain("aarch64-apple-darwin");
    expect(workflow).toContain("windows-latest");
    expect(workflow).toContain("x86_64-pc-windows-msvc");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY");
    expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
    expect(workflow).toContain("tauri-apps/tauri-action@v0.6.2");
    expect(workflow).toContain("tagName: v__VERSION__");
    expect(workflow).toContain("releaseDraft: false");
  });
});
