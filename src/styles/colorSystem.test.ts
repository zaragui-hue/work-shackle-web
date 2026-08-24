import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8").toLowerCase();

describe("dopamine brutalist color system", () => {
  it("defines the approved semantic palette", () => {
    const tokens = readSource("src/styles/tokens.css");

    expect(tokens).toContain("--color-canvas: #fff7df");
    expect(tokens).toContain("--color-stage: #2448ff");
    expect(tokens).toContain("--color-signal: #ffd45e");
    expect(tokens).toContain("--color-reaction: #ff7a52");
    expect(tokens).toContain("--color-danger: #ff3d57");
    expect(tokens).toContain("--color-anchor: #241c16");
    expect(tokens).toContain("--color-ink-muted: #6e5548");
  });

  it("removes the retired core palette", () => {
    const source = [
      "src/styles/tokens.css",
      "src/styles/base.css",
      "src/shared/shell/AppShell.css",
      "src/pages/TodayPage.css",
      "src/features/today/StatusCockpit.css",
    ]
      .map(readSource)
      .join("\n");

    for (const retired of [
      "#efede5",
      "#345cff",
      "#cfff24",
      "#ff4b2e",
      "#d93822",
    ]) {
      expect(source).not.toContain(retired);
    }
  });

  it("keeps the cockpit blue, reaction coral, and meme sticker yellow", () => {
    const cockpit = readSource("src/features/today/StatusCockpit.css");
    const tools = readSource("src/features/today/WorkScheduleEditor.css");

    expect(cockpit).toMatch(
      /\.status-cockpit__work[\s\S]*?background:\s*var\(--color-stage\)/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit__reaction[\s\S]*?background:\s*var\(--color-reaction\)/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit__speech[\s\S]*?background:\s*var\(--color-signal\)/,
    );
    expect(tools).toMatch(
      /\.work-schedule-editor[\s\S]*?background:\s*var\(--color-anchor\)/,
    );
  });

  it("assigns signal yellow to the shell and stage blue to active navigation", () => {
    const shell = readSource("src/shared/shell/AppShell.css");

    expect(shell).toMatch(
      /\.ws-shell__brand[\s\S]*?background:\s*var\(--color-signal\)/,
    );
    expect(shell).toMatch(
      /\.ws-shell__tab--active[\s\S]*?background:\s*var\(--color-stage\)/,
    );
  });

  it("defines the giant badge typography roles", () => {
    const tokens = readSource("src/styles/tokens.css");

    expect(tokens).toContain("--font-size-hero: clamp(4rem, 6.9vw, 5.5rem)");
    expect(tokens).toContain(
      "--font-size-countdown: clamp(8rem, 13.8vw, 11rem)",
    );
    expect(tokens).toContain(
      "--font-size-page-title: clamp(1.75rem, 3vw, 2.375rem)",
    );
    expect(tokens).toContain(
      "--font-size-task-title: clamp(1.125rem, 1.8vw, 1.375rem)",
    );
    expect(tokens).toContain(
      "--font-size-meta: clamp(0.8125rem, 1.15vw, 0.9375rem)",
    );
  });

  it("uses the brand and navigation type roles in the shell", () => {
    const shell = readSource("src/shared/shell/AppShell.css");

    expect(shell).toMatch(
      /\.ws-shell__heading[\s\S]*?font-size:\s*var\(--font-size-brand\)/,
    );
    expect(shell).toMatch(
      /\.ws-shell__tab[\s\S]*?font-size:\s*var\(--font-size-nav\)/,
    );
  });

  it("uses poster-scale headline, countdown, and reaction type", () => {
    const countdown = readSource("src/features/today/WorkCountdownBanner.css");
    const cockpit = readSource("src/features/today/StatusCockpit.css");

    expect(countdown).toMatch(
      /\.work-countdown__headline[\s\S]*?font-size:\s*var\(--font-size-hero\)/,
    );
    expect(countdown).toMatch(
      /\.work-countdown__digit--hours[\s\S]*?font-size:\s*var\(--font-size-countdown\)/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit__meme-mark[\s\S]*?font-size:\s*clamp\(10rem,\s*17vw,\s*13\.75rem\)/,
    );
  });
});
