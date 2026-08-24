import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { WorkCountdownBanner } from "./WorkCountdownBanner";

afterEach(cleanup);

describe("WorkCountdownBanner", () => {
  it("splits the remaining time into hour minute second units", () => {
    render(
      <WorkCountdownBanner
        display={{
          phase: "working",
          primaryText: "距离下班还有",
          countdownText: "08:24:18",
        }}
        schedule={{
          workDate: "2026-08-19",
          defaultStart: "09:30",
          defaultEnd: "18:30",
          effectiveStart: "09:30",
          effectiveEnd: "18:30",
          hasTodayOverride: false,
        }}
      />,
    );

    expect(screen.getByText("LIVE / 距离释放")).toBeTruthy();
    expect(screen.getByLabelText("08:24:18")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "今日工作进度" })).toBeTruthy();
    expect(screen.getByText("时")).toBeTruthy();
    expect(screen.getByText("分")).toBeTruthy();
    expect(screen.getByText("秒")).toBeTruthy();
    expect(screen.queryByText("09:30 开工")).toBeNull();
    expect(screen.queryByText("18:30 下班")).toBeNull();
    expect(screen.getByText(/班味 \d+%/)).toBeTruthy();
  });
});
