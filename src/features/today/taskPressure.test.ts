import { describe, expect, it } from "vitest";

import { buildTaskPressure } from "./taskPressure";

describe("buildTaskPressure", () => {
  it("mirrors the Rust DDL emotion boundaries", () => {
    expect(buildTaskPressure(0, 1_000, 400).emotion).toBe("calm");
    expect(buildTaskPressure(0, 1_000, 401).emotion).toBe("notice");
    expect(buildTaskPressure(0, 1_000, 650).emotion).toBe("notice");
    expect(buildTaskPressure(0, 1_000, 651).emotion).toBe("anxious");
    expect(buildTaskPressure(0, 1_000, 800).emotion).toBe("anxious");
    expect(buildTaskPressure(0, 1_000, 801).emotion).toBe("panic");
    expect(buildTaskPressure(0, 1_000, 950).emotion).toBe("panic");
    expect(buildTaskPressure(0, 1_000, 951).emotion).toBe("burning");
    expect(buildTaskPressure(0, 1_000, 1_000).emotion).toBe("burning");
    expect(buildTaskPressure(0, 1_000, 1_001).emotion).toBe("overdue");
  });

  it("clamps the rail but keeps an expressive overdue percentage", () => {
    expect(buildTaskPressure(0, 1_000, 1_200)).toMatchObject({
      progressRatio: 1.2,
      fillPercent: 100,
      percentLabel: "120%",
    });
    expect(buildTaskPressure(0, 1_000, 10_000).percentLabel).toBe("999%+");
  });

  it("uses a neutral fallback for missing or invalid intervals", () => {
    expect(buildTaskPressure(1_000, undefined, 1_000)).toMatchObject({
      valid: false,
      percentLabel: "--%",
      emotion: "calm",
    });
    expect(buildTaskPressure(1_000, 1_000, 1_000).valid).toBe(false);
  });

  it("shows zero before the planned start", () => {
    expect(buildTaskPressure(1_000, 2_000, 500)).toMatchObject({
      progressRatio: 0,
      fillPercent: 0,
      percentLabel: "0%",
      emotion: "calm",
    });
  });
});
