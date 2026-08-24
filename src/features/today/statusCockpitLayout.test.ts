import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readCss = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8").toLowerCase();

describe("status cockpit split layout", () => {
  const cockpit = readCss("src/features/today/StatusCockpit.css");
  const page = readCss("src/pages/TodayPage.css");

  it("uses the approved desktop ratio with equal-height sibling panels", () => {
    expect(cockpit).toMatch(
      /\.status-cockpit\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*2\.15fr\)\s+minmax\(285px,\s*1fr\)/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit\s*\{[^}]*align-items:\s*stretch/,
    );
  });

  it("gives each panel its own surface and clipping boundary", () => {
    expect(cockpit).toMatch(
      /\.status-cockpit__work\s*\{[^}]*background:\s*var\(--color-stage\)/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit__work\s*\{[^}]*overflow:\s*hidden/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit__reaction\s*\{[^}]*background:\s*var\(--color-reaction\)/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit__reaction\s*\{[^}]*overflow:\s*hidden/,
    );
  });

  it("makes the page stage wrapper transparent", () => {
    expect(page).toMatch(
      /\.today-page__stage\s*\{[^}]*background:\s*transparent/,
    );
  });

  it("stacks countdown above status at 860 pixels", () => {
    expect(cockpit).toMatch(
      /@media\s*\(max-width:\s*860px\)[\s\S]*?\.status-cockpit\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    );
  });
});
