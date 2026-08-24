import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatusCockpit } from "./StatusCockpit";

vi.mock("./WorkStatusContext", () => ({
  useWorkStatus: () => ({
    current: {
      recordId: "status-1",
      statusType: "chased_by_requirements",
      emoji: "🏃",
      name: "被需求追杀",
      displayCopy: "需求说不急，只是希望你十分钟前交。",
      workDate: "2026-08-24",
      startAtMs: 1,
    },
    loading: false,
  }),
}));

vi.mock("./WorkStatusPanel", () => ({
  WorkStatusPanel: () => <div>精神状态选择</div>,
}));

vi.mock("../../shared/ui", () => ({
  Mascot: () => <div>精神状态吉祥物</div>,
}));

afterEach(cleanup);

describe("StatusCockpit", () => {
  it("renders countdown and status as sibling panels", () => {
    render(
      <StatusCockpit>
        <div>倒计时主视觉</div>
      </StatusCockpit>,
    );

    const countdown = screen.getByLabelText("下班倒计时");
    const status = screen.getByLabelText("当前工作状态");

    expect(countdown.parentElement).toBe(status.parentElement);
    expect(countdown.nextElementSibling).toBe(status);
    expect(within(countdown).getByText("倒计时主视觉")).toBeTruthy();
  });

  it("keeps status controls, mascot, and copy inside the status panel", () => {
    render(
      <StatusCockpit>
        <div>倒计时主视觉</div>
      </StatusCockpit>,
    );

    const countdown = screen.getByLabelText("下班倒计时");
    const status = screen.getByLabelText("当前工作状态");

    expect(within(status).getByText("精神状态选择")).toBeTruthy();
    expect(within(status).getByText("精神状态吉祥物")).toBeTruthy();
    expect(within(status).getByText(/被需求追杀/)).toBeTruthy();
    expect(within(countdown).queryByText(/被需求追杀/)).toBeNull();
  });
});
