import { describe, expect, it } from "vitest";

import {
  defaultExplosionPostponeClock,
  nextDeadlineFromClock,
} from "./deadlineExplosionTime";

const at = (hours: number, minutes = 0) =>
  new Date(2026, 7, 27, hours, minutes, 0, 0).getTime();

describe("deadlineExplosionTime", () => {
  it("keeps a later clock time on the same day", () => {
    expect(nextDeadlineFromClock("18:30", at(17))).toBe(at(18, 30));
  });

  it("moves an earlier or equal clock time to tomorrow", () => {
    expect(nextDeadlineFromClock("09:00", at(17))).toBe(at(9) + 24 * 60 * 60 * 1000);
    expect(nextDeadlineFromClock("17:00", at(17))).toBe(at(17) + 24 * 60 * 60 * 1000);
  });

  it("rejects invalid clock values", () => {
    expect(() => nextDeadlineFromClock("25:00", at(17))).toThrow();
    expect(() => nextDeadlineFromClock("9:00", at(17))).toThrow();
  });

  it("defaults to one hour after now", () => {
    expect(defaultExplosionPostponeClock(at(17, 12))).toBe("18:12");
  });
});
