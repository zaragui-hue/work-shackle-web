import { describe, expect, it } from "vitest";

import { computeWorkCountdown, workCountdownHeadline } from "./workCountdown";

const defaultSchedule = {
  workDate: "2026-08-14",
  effectiveStart: "09:30",
  effectiveEnd: "18:00",
};

function localMs(hour: number, minute: number, second = 0): number {
  return new Date(2026, 7, 14, hour, minute, second, 0).getTime();
}

describe("computeWorkCountdown", () => {
  it("shows start message before work begins", () => {
    const result = computeWorkCountdown(defaultSchedule, localMs(9, 29, 59));

    expect(result.phase).toBe("before_start");
    expect(result.primaryText).toBe("今天 09:30 开工");
    expect(result.countdownText).toBeNull();
  });

  it("shows countdown during working hours", () => {
    const result = computeWorkCountdown(defaultSchedule, localMs(12, 0, 0));

    expect(result.phase).toBe("working");
    expect(result.primaryText).toMatch(/班味|副本|工位|进度条/);
    expect(result.countdownText).toBe("06:00:00");
  });

  it("matches copy stages to the remaining time", () => {
    expect(
      workCountdownHeadline(
        "2026-08-14",
        7 * 60 * 60 * 1000,
        localMs(10, 0),
      ),
    ).toMatch(/系统|工位|下班|赛博工牌/);
    expect(
      workCountdownHeadline(
        "2026-08-14",
        6 * 60 * 60 * 1000,
        localMs(11, 0),
      ),
    ).toMatch(/班味|副本|工位|进度条/);
    expect(
      workCountdownHeadline(
        "2026-08-14",
        3 * 60 * 60 * 1000,
        localMs(12, 0),
      ),
    ).toMatch(/释放协议|下班权限|赛博越狱|自由信号/);
    expect(
      workCountdownHeadline(
        "2026-08-14",
        60 * 60 * 1000,
        localMs(16, 0),
      ),
    ).toMatch(/释放协议|下班权限|赛博越狱|自由信号/);
    expect(
      workCountdownHeadline(
        "2026-08-14",
        60 * 60 * 1000 - 1,
        localMs(17, 0),
      ),
    ).toMatch(/关机程序|门禁|班味|撤离倒计时/);
  });

  it("keeps copy stable within an hour and changes at the next clock hour", () => {
    const before = workCountdownHeadline(
      "2026-08-14",
      5 * 60 * 60 * 1000,
      localMs(10, 1),
    );
    const sameHour = workCountdownHeadline(
      "2026-08-14",
      5 * 60 * 60 * 1000 - 30 * 60 * 1000,
      localMs(10, 31),
    );
    const nextHour = workCountdownHeadline(
      "2026-08-14",
      4 * 60 * 60 * 1000,
      localMs(11, 0),
    );

    expect(sameHour).toBe(before);
    expect(nextHour).not.toBe(before);
  });

  it("shows one second remaining before end", () => {
    const result = computeWorkCountdown(defaultSchedule, localMs(17, 59, 59));

    expect(result.phase).toBe("working");
    expect(result.countdownText).toBe("00:00:01");
  });

  it("shows end message when current time equals end", () => {
    const result = computeWorkCountdown(defaultSchedule, localMs(18, 0, 0));

    expect(result.phase).toBe("after_end");
    expect(result.primaryText).toBe("今天已经到下班时间");
    expect(result.countdownText).toBeNull();
  });

  it("shows end message after end time", () => {
    const result = computeWorkCountdown(defaultSchedule, localMs(20, 0, 0));

    expect(result.phase).toBe("after_end");
    expect(result.primaryText).toBe("今天已经到下班时间");
  });

  it("uses effective override times from schedule facts", () => {
    const overrideSchedule = {
      workDate: "2026-08-14",
      effectiveStart: "10:00",
      effectiveEnd: "20:00",
    };

    const beforeOverrideStart = computeWorkCountdown(
      overrideSchedule,
      localMs(9, 30, 0),
    );
    expect(beforeOverrideStart.phase).toBe("before_start");
    expect(beforeOverrideStart.primaryText).toBe("今天 10:00 开工");

    const duringOverride = computeWorkCountdown(
      overrideSchedule,
      localMs(19, 0, 0),
    );
    expect(duringOverride.phase).toBe("working");
    expect(duringOverride.countdownText).toBe("01:00:00");
  });
});
