import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const settingsPage = readFileSync(
  join(process.cwd(), "src/pages/SettingsPage.tsx"),
  "utf8",
);

describe("SettingsPage structure", () => {
  it("keeps the supported time and status settings", () => {
    expect(settingsPage).toContain("默认工作时间");
    expect(settingsPage).toContain("午餐时间");
    expect(settingsPage).toContain("<StatusCopySection />");
  });

  it("removes today's override controls from settings only", () => {
    expect(settingsPage).not.toContain("今日工作时间");
    expect(settingsPage).not.toContain("saveTodayWorkOverride");
    expect(settingsPage).not.toContain("clearTodayWorkOverride");
    expect(settingsPage).not.toContain("today-work-override-form");
  });

  it("removes the busy rule configuration entry", () => {
    expect(settingsPage).not.toContain("BusyRuleSection");
    expect(settingsPage).not.toContain("日历忙碌状态");
  });
});
