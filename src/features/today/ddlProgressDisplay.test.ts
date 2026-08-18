import { describe, expect, it } from "vitest";

import {
  canShowDdlProgress,
  ddlEmotionLabel,
  ddlProgressFillPercent,
  formatTimeElapsedCopy,
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
