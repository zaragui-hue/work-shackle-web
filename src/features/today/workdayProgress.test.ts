import { describe, expect, it } from "vitest";

import { getWorkdayProgress } from "./workdayProgress";

const schedule = {
  workDate: "2026-08-21",
  defaultStart: "09:00",
  defaultEnd: "18:00",
  effectiveStart: "09:00",
  effectiveEnd: "18:00",
  hasTodayOverride: false,
};

describe("getWorkdayProgress", () => {
  it("moves through the five narrative moods", () => {
    expect(getWorkdayProgress(schedule, at("09:30")).mood).toBe("clear");
    expect(getWorkdayProgress(schedule, at("12:00")).mood).toBe("power-save");
    expect(getWorkdayProgress(schedule, at("14:30")).mood).toBe("drained");
    expect(getWorkdayProgress(schedule, at("17:00")).mood).toBe("sprint");
    expect(getWorkdayProgress(schedule, at("18:00")).mood).toBe("offwork");
  });

  it("clamps progress outside the workday", () => {
    expect(getWorkdayProgress(schedule, at("08:00")).progress).toBe(0);
    expect(getWorkdayProgress(schedule, at("20:00")).progress).toBe(100);
  });
});

function at(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(2026, 7, 21, hour, minute).getTime();
}
