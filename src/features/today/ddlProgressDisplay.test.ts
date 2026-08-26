import { describe, expect, it } from "vitest";

import {
  canShowDdlProgress,
  ddlEmotionLabel,
  ddlProgressFillPercent,
  formatTimeElapsedCopy,
  overdueChaosLabel,
  overdueChaosLevel,
  taskStatusStampCopy,
} from "./ddlProgressDisplay";

describe("canShowDdlProgress", () => {
  it("hides progress when deadline is missing", () => {
    expect(canShowDdlProgress(1_000, undefined)).toBe(false);
  });

  it("hides progress when planned time is missing", () => {
    expect(canShowDdlProgress(undefined, 2_000)).toBe(false);
  });

  it("shows progress only for a valid planned/deadline interval", () => {
    expect(canShowDdlProgress(1_000, 2_000)).toBe(true);
    expect(canShowDdlProgress(2_000, 2_000)).toBe(false);
    expect(canShowDdlProgress(2_000, 1_000)).toBe(false);
  });
});

describe("formatTimeElapsedCopy", () => {
  it("describes elapsed time, not task completion", () => {
    const copy = formatTimeElapsedCopy(0.62);

    expect(copy).toBe("时间已走过 62%");
    expect(copy).not.toMatch(/任务完成|任务进度|完成度/);
  });

  it("keeps overdue ratios above 100% as time elapsed", () => {
    expect(formatTimeElapsedCopy(1.1)).toBe("时间已走过 110%");
  });
});

describe("ddlEmotionLabel", () => {
  it("maps Rust emotion values to light copy", () => {
    expect(ddlEmotionLabel("calm")).toBe("从容");
    expect(ddlEmotionLabel("notice")).toBe("注意");
    expect(ddlEmotionLabel("anxious")).toBe("着急");
    expect(ddlEmotionLabel("panic")).toBe("慌张");
    expect(ddlEmotionLabel("burning")).toBe("火烧眉毛");
    expect(ddlEmotionLabel("overdue")).toBe("已逾期");
  });
});

describe("ddlProgressFillPercent", () => {
  it("clamps the bar for display without inventing a 0% when hidden", () => {
    expect(ddlProgressFillPercent(0.4)).toBe(40);
    expect(ddlProgressFillPercent(1.1)).toBe(100);
    expect(ddlProgressFillPercent(0)).toBe(0);
  });
});

describe("taskStatusStampCopy", () => {
  it("uses short state-aware chaos copy with the emoji first", () => {
    expect(taskStatusStampCopy("not_started")).toBe("🫥 活还没醒");
    expect(taskStatusStampCopy("in_progress")).toBe("🐴 牛马强制上线");
    expect(taskStatusStampCopy("paused")).toBe("🫠 工位融化中");
    expect(taskStatusStampCopy("waiting")).toBe("🤡 等一个天降奇迹");
  });
});

describe("overdueChaosLevel", () => {
  const hour = 60 * 60 * 1_000;
  const now = new Date(2026, 7, 26, 12).getTime();

  it("changes tiers exactly at 24 and 72 hours overdue", () => {
    expect(overdueChaosLevel(now - 23 * hour, now)).toBe("slightly");
    expect(overdueChaosLevel(now - 24 * hour, now)).toBe("serious");
    expect(overdueChaosLevel(now - 71 * hour, now)).toBe("serious");
    expect(overdueChaosLevel(now - 72 * hour, now)).toBe("gave_up");
  });

  it("provides the approved stamp labels", () => {
    expect(overdueChaosLabel("slightly")).toBe("有点超时");
    expect(overdueChaosLabel("serious")).toBe("严重超时");
    expect(overdueChaosLabel("gave_up")).toBe("放弃挣扎");
  });
});
