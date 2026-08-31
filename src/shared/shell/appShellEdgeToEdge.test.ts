import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const baseCss = readFileSync(
  join(process.cwd(), "src/styles/base.css"),
  "utf8",
);
const shellCss = readFileSync(
  join(process.cwd(), "src/shared/shell/AppShell.css"),
  "utf8",
);

describe("AppShell edge-to-edge layout", () => {
  it("uses the paper canvas across the complete WebView", () => {
    expect(baseCss).toMatch(
      /html,\s*body,\s*#root\s*\{[^}]*min-height:\s*100%/,
    );
    expect(baseCss).toMatch(
      /body\s*\{[^}]*background-color:\s*var\(--color-paper\)/,
    );
    expect(baseCss).not.toMatch(/body\s*\{[^}]*background-image:/);
  });

  it("fills the normal window without an outer panel frame", () => {
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*min-height:\s*100dvh/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*width:\s*100%/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*max-width:\s*none/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*margin:\s*0/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*border:\s*0/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*border-radius:\s*0/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*box-shadow:\s*none/);
  });

  it("does not restore the picture frame at the narrow breakpoint", () => {
    const narrowShell = shellCss.match(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*?\.ws-shell\s*\{([^}]*)\}/,
    )?.[1];

    expect(narrowShell).toBeDefined();
    expect(narrowShell).not.toMatch(/width:/);
    expect(narrowShell).not.toMatch(/margin:/);
    expect(narrowShell).not.toMatch(/border-radius:/);
  });
});
