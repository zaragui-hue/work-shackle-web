import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { EmptyState } from "../../shared/ui";
import { LunchReminderBanner } from "./LunchReminderBanner";
import { OvertimeBanner } from "./OvertimeBanner";
import {
  WorkEndDecisionBanner,
  WorkOffCompleteBanner,
} from "./WorkEndDecisionBanner";
import { WorkStatusPanel } from "./WorkStatusPanel";
import { WorkStatusProvider } from "./WorkStatusContext";

vi.mock("../../services/tauri/workStatus", () => ({
  listWorkStatuses: vi.fn(async () => [
    {
      id: "meeting",
      emoji: "💻",
      name: "会议中",
      sortOrder: 3,
      selectable: true,
    },
    {
      id: "slacking",
      emoji: "🐟",
      name: "摸鱼中",
      sortOrder: 6,
      selectable: true,
    },
  ]),
  getCurrentWorkStatus: vi.fn(async () => ({
    recordId: "r1",
    statusType: "meeting",
    emoji: "💻",
    name: "会议中",
    displayCopy: "人还在会议室，灵魂可能已经去午睡了。",
    workDate: "2026-08-18",
    startAtMs: 1,
  })),
  switchWorkStatus: vi.fn(),
  mapWorkStatusError: () => "工作状态操作失败",
}));

afterEach(cleanup);

function mascotState(container: HTMLElement): string | null {
  return (
    container
      .querySelector("img[data-mascot-state]")
      ?.getAttribute("data-mascot-state") ?? null
  );
}

function mascotAnimation(container: HTMLElement): string | null {
  return (
    container
      .querySelector("img[data-mascot-animation]")
      ?.getAttribute("data-mascot-animation") ?? null
  );
}

describe("today mascot placeholders", () => {
  it("uses overtime-dead-eyes for the overtime banner character", () => {
    const { container } = render(
      <OvertimeBanner elapsedText="01:00:00" onEnd={() => {}} />,
    );

    expect(mascotState(container)).toBe("overtime-dead-eyes");
    expect(mascotAnimation(container)).toBe("none");
    expect(screen.queryByText("🌙")).toBeNull();
  });

  it("uses offwork-run for work-end and off-work banners", () => {
    const decision = render(
      <WorkEndDecisionBanner
        onConfirmNormalOff={() => {}}
        onStartOvertime={() => {}}
      />,
    );
    expect(mascotState(decision.container)).toBe("offwork-run");
    expect(mascotAnimation(decision.container)).toBe("run");
    expect(screen.queryByText("🕕")).toBeNull();
    decision.unmount();

    const complete = render(
      <WorkOffCompleteBanner message="好好休息" />,
    );
    expect(mascotState(complete.container)).toBe("offwork-run");
    expect(mascotAnimation(complete.container)).toBe("run");
    expect(screen.queryByText("🎒")).toBeNull();
  });

  it("uses lunch-happy for the lunch reminder character", () => {
    const { container } = render(
      <LunchReminderBanner
        reminder={{
          reminderDate: "2026-08-18",
          lunchStart: "12:00",
          lunchEnd: "13:00",
          message: "先吃饭",
        }}
        onDismiss={() => {}}
      />,
    );

    expect(mascotState(container)).toBe("lunch-happy");
    expect(mascotAnimation(container)).toBe("breathe");
    expect(screen.queryByText("🍚")).toBeNull();
  });

  it("uses a canonical mascot for current work status but keeps status emoji", async () => {
    const { container } = render(
      <WorkStatusProvider>
        <WorkStatusPanel />
      </WorkStatusProvider>,
    );

    expect(
      await screen.findByText("人还在会议室，灵魂可能已经去午睡了。"),
    ).toBeTruthy();
    expect(mascotState(container)).toBe("meeting-empty");
    expect(mascotAnimation(container)).toBe("breathe");
    expect(screen.getByRole("combobox", { name: "当前状态" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "💻 会议中" })).toBeTruthy();
  });
});

describe("EmptyState mascot", () => {
  it("renders through the shared Mascot contract", () => {
    const { container } = render(
      <EmptyState title="暂无任务" description="先歇一会儿" />,
    );

    expect(mascotState(container)).toBe("fish-relax");
    expect(mascotAnimation(container)).toBe("none");
  });
});
