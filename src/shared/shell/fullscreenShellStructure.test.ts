import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(process.cwd(), "src/shared/shell/AppShell.tsx"),
  "utf8",
);

describe("AppShell fullscreen structure", () => {
  it("binds native fullscreen state to the shell and exit control", () => {
    expect(source).toContain("useWindowFullscreen()");
    expect(source).toContain("ws-shell--fullscreen");
    expect(source).toContain('aria-label="退出全屏"');
    expect(source).toContain("exitFullscreen");
  });
});
