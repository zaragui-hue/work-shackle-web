import { describe, expect, it } from "vitest";
import { countdownHeadline, workdayProgress } from "./todayPresentation";

describe("today presentation", () => {
  it("uses stable work-progress headlines", () => {
    expect(countdownHeadline("before_start", 0)).toBe("离开工还有");
    expect(countdownHeadline("working", .52)).toBe("已经熬过一半，别在这时散架");
    expect(countdownHeadline("after_end", 1, true, false)).toBe("正在加班");
    expect(countdownHeadline("after_end", 1, false, true)).toBe("今天已经下班");
  });

  it("clamps workday progress", () => {
    const schedule = { workDate: "2026-08-28", start: "09:00", end: "18:00" };
    expect(workdayProgress(schedule, new Date(2026, 7, 28, 8).getTime())).toBe(0);
    expect(workdayProgress(schedule, new Date(2026, 7, 28, 13, 30).getTime())).toBe(.5);
    expect(workdayProgress(schedule, new Date(2026, 7, 28, 20).getTime())).toBe(1);
  });
});
