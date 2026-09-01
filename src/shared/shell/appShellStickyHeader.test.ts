import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/shared/shell/AppShell.css"),
  "utf8",
);

describe("AppShell sticky header", () => {
  it("keeps the complete brand row pinned above scrolling content", () => {
    expect(css).toMatch(/\.ws-shell\s*{[\s\S]*?overflow:\s*clip/);
    expect(css).toMatch(/\.ws-shell__brand\s*{[\s\S]*?position:\s*sticky/);
    expect(css).toMatch(/\.ws-shell__brand\s*{[\s\S]*?top:\s*0/);
    expect(css).toMatch(/\.ws-shell__brand\s*{[\s\S]*?z-index:\s*30/);
  });
});
