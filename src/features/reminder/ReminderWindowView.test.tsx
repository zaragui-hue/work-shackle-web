import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReminderWindowShowPayload } from "../../services/tauri/reminder";
import { ReminderWindowView } from "./ReminderWindowView";

vi.mock("./reminderWindowActions", () => ({
  openTaskFromReminderWindow: vi.fn(),
  beginTaskFromReminderWindow: vi.fn(),
  postponeTaskFromReminderWindow: vi.fn(),
  completeTaskFromReminderWindow: vi.fn(),
}));

afterEach(cleanup);

function systemPayload(
  reminderKind: string,
): ReminderWindowShowPayload {
  return {
    primary: {
      kind: "system",
      taskId: "t1",
      taskTitle: "提交方案",
      reminderKind,
      deadlineSnapshotMs: 20_000,
      triggerAtMs: 10_000,
      firedAtMs: 10_000,
    },
    additionalCount: 0,
  };
}

describe("ReminderWindowView mascot", () => {
  it("uses the 0901 reminder mapping instead of a placeholder character", () => {
    const { container } = render(
      <ReminderWindowView payload={systemPayload("one_hour_remaining")} onDismiss={() => {}} />,
    );

    const mascot = container.querySelector("img[data-mascot-state]");
    expect(mascot?.getAttribute("data-mascot-state")).toBe("ddl-panic");
    expect(mascot?.getAttribute("data-mascot-animation")).toBe("panic");
    expect(screen.queryByText("占位小角色")).toBeNull();
    expect(screen.queryByText("😟")).toBeNull();
    expect(
      screen.getByText("最后一小时。现在开始努力，至少能显得之前不是纯摸鱼。"),
    ).toBeTruthy();
    expect(screen.getByText("01:00")).toBeTruthy();
  });

  it("maps progress and custom reminders through the same contract", () => {
    const { container, rerender } = render(
      <ReminderWindowView payload={systemPayload("progress_half")} onDismiss={() => {}} />,
    );

    expect(
      container.querySelector("img[data-mascot-state]")?.getAttribute("data-mascot-state"),
    ).toBe("ddl-calm");
    expect(
      container
        .querySelector("img[data-mascot-animation]")
        ?.getAttribute("data-mascot-animation"),
    ).toBe("breathe");

    rerender(
      <ReminderWindowView
        payload={{
          primary: {
            kind: "custom",
            reminderId: "r1",
            taskId: "t1",
            taskTitle: "写周报",
            remindAtMs: 1000,
            firedAtMs: 1000,
            message: "别忘了交",
          },
          additionalCount: 0,
        }}
        onDismiss={() => {}}
      />,
    );

    expect(
      container.querySelector("img[data-mascot-state]")?.getAttribute("data-mascot-state"),
    ).toBe("work-neutral");
    expect(
      container
        .querySelector("img[data-mascot-animation]")
        ?.getAttribute("data-mascot-animation"),
    ).toBe("breathe");
  });

  it("keeps the task title as the dialog heading and wraps long titles", () => {
    const longTitle =
      "这是一个特别特别特别长的任务标题，用来确认提醒窗不会把按钮和文案挤出窗口";
    const { container } = render(
      <ReminderWindowView
        payload={{
          primary: {
            kind: "custom",
            reminderId: "r-long",
            taskId: "t-long",
            taskTitle: longTitle,
            remindAtMs: 1000,
            firedAtMs: 1000,
            message: "别忘了把这段特别长的自定义提醒也看一眼",
          },
          additionalCount: 2,
        }}
        onDismiss={() => {}}
      />,
    );

    expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(longTitle);
    expect(screen.getByText("还有 2 个任务也在催")).toBeTruthy();
    expect(screen.getByRole("button", { name: "去把坑填上 →" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "我知道了，别催" })).toBeTruthy();
    expect(container.querySelector(".ws-mascot-frame--md")).toBeTruthy();
    expect(container.querySelector(".ws-mascot-frame--lg")).toBeNull();
  });

  it("routes ddl due payloads to the explosion dialog", () => {
    render(
      <ReminderWindowView payload={systemPayload("ddl_due")} onDismiss={() => {}} />,
    );

    expect(screen.getByRole("dialog", { name: "提交方案" })).toBeTruthy();
    expect(screen.getByLabelText("到点爆炸")).toBeTruthy();
    expect(screen.getByRole("button", { name: "现在处理" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "延期" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "结束任务" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "我知道了，别催" })).toBeNull();
  });
});
