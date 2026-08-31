import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src/shared/shell/AppShellFullscreen.css"),
  "utf8",
);

describe("fullscreen shell layout", () => {
  it("fills the viewport without the windowed outer frame", () => {
    expect(css).toMatch(
      /\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*width:\s*100%/,
    );
    expect(css).toMatch(
      /\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*min-height:\s*100dvh/,
    );
    expect(css).toMatch(
      /\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*max-width:\s*none/,
    );
    expect(css).toMatch(
      /\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*margin:\s*0/,
    );
    expect(css).toMatch(
      /\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*border-radius:\s*0/,
    );
  });

  it("uses a fluid control column on wide Today pages", () => {
    expect(css).toMatch(
      /\.ws-shell--fullscreen\s+\.today-page__dashboard[\s\S]*?clamp\(340px,\s*22vw,\s*460px\)/,
    );
    expect(css).toMatch(
      /@media\s*\(max-width:\s*760px\)[\s\S]*?\.ws-shell--fullscreen\s+\.today-page__dashboard\s*\{[^}]*grid-template-columns:\s*1fr/,
    );
  });
});
