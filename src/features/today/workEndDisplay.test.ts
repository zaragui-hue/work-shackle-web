import { describe, expect, it } from "vitest";

import { isWorkDayFinished } from "./workEndDisplay";

describe("isWorkDayFinished", () => {
  it("treats normal_off and overtime_finished as terminal work-day states", () => {
    expect(isWorkDayFinished("normal_off")).toBe(true);
    expect(isWorkDayFinished("overtime_finished")).toBe(true);
  });

  it("does not treat active or pending phases as finished", () => {
    expect(isWorkDayFinished("before_end")).toBe(false);
    expect(isWorkDayFinished("pending_decision")).toBe(false);
    expect(isWorkDayFinished("overtime_active")).toBe(false);
    expect(isWorkDayFinished(undefined)).toBe(false);
  });
});
