import { describe, expect, it } from "vitest";

import { resolveDynamicAppIconState } from "./dynamicAppIconState";

function at(hour: number, minute = 0): number {
  return new Date(2026, 7, 31, hour, minute, 0, 0).getTime();
}

describe("resolveDynamicAppIconState", () => {
  it.each([
    [at(9, 59), "morning"],
    [at(10), "default"],
    [at(13, 59), "default"],
    [at(14), "afternoon"],
  ] as const)("maps ordinary time %s to %s", (nowMs, expected) => {
    expect(resolveDynamicAppIconState({ nowMs })).toBe(expected);
  });

  it("starts the off-work reward exactly thirty minutes before work ends", () => {
    expect(resolveDynamicAppIconState({
      nowMs: at(17, 29),
      workEndAtMs: at(18),
    })).toBe("afternoon");
    expect(resolveDynamicAppIconState({
      nowMs: at(17, 30),
      workEndAtMs: at(18),
    })).toBe("offwork_soon");
  });

  it("starts the alert exactly thirty minutes before the nearest DDL", () => {
    expect(resolveDynamicAppIconState({
      nowMs: at(16),
      nearestDeadlineAtMs: at(16, 31),
    })).toBe("afternoon");
    expect(resolveDynamicAppIconState({
      nowMs: at(16),
      nearestDeadlineAtMs: at(16, 30),
    })).toBe("deadline_alert");
    expect(resolveDynamicAppIconState({
      nowMs: at(16),
      nearestDeadlineAtMs: at(15),
    })).toBe("deadline_alert");
  });

  it("uses deadline over overtime and overtime over off-work-soon", () => {
    expect(resolveDynamicAppIconState({
      nowMs: at(17, 45),
      workEndAtMs: at(18),
      activeOvertime: true,
      nearestDeadlineAtMs: at(18),
    })).toBe("deadline_alert");
    expect(resolveDynamicAppIconState({
      nowMs: at(17, 45),
      workEndAtMs: at(18),
      activeOvertime: true,
    })).toBe("overtime");
  });

  it("uses explicit working state after work end as overtime", () => {
    expect(resolveDynamicAppIconState({
      nowMs: at(18),
      workEndAtMs: at(18),
      isWorking: true,
    })).toBe("overtime");
  });
});
