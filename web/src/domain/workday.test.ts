import { describe, expect, it, vi } from "vitest";
import { createDefaultData } from "./defaultData";
import { activeOvertime, countdown, dueReminder, endOvertime, startOvertime, switchStatus } from "./workday";

vi.stubGlobal("crypto", { randomUUID: () => `id-${Math.random()}` });
const at = (hour: number, minute = 0) => new Date(2026, 7, 27, hour, minute).getTime();

describe("workday rules", () => {
  it("calculates before-work, working and after-work phases", () => {
    const data = createDefaultData(at(8));
    expect(countdown(data, at(8)).phase).toBe("before_start");
    expect(countdown(data, at(10)).phase).toBe("working");
    expect(countdown(data, at(19)).phase).toBe("after_end");
  });

  it("switches status while closing the prior record", () => {
    const working = switchStatus(createDefaultData(at(8)), "working", at(9));
    const lunch = switchStatus(working, "lunch", at(12));
    expect(lunch.workStatusRecords[0].endAtMs).toBe(at(12));
    expect(lunch.workStatusRecords[1].statusType).toBe("lunch");
  });

  it("finds a reminder only inside its five-minute window", () => {
    const data = createDefaultData(at(8));
    expect(dueReminder(data, at(10, 32))?.id).toBe("water-1030");
    expect(dueReminder(data, at(10, 40))).toBeUndefined();
  });

  it("preserves completed overtime", () => {
    const started = startOvertime(createDefaultData(at(18)), at(18, 1));
    expect(activeOvertime(started)?.startAtMs).toBe(at(18, 1));
    const ended = endOvertime(started, at(20));
    expect(activeOvertime(ended)).toBeUndefined();
    expect(ended.overtimeRecords[0].endAtMs).toBe(at(20));
  });
});
