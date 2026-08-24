import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { ReminderWindowShowPayload } from "../../services/tauri/reminder";
import { ReminderWindowView } from "./ReminderWindowView";

vi.mock("./reminderWindowActions", () => ({
  openTaskFromReminderWindow: vi.fn(),
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
      <ReminderWindowView payload={systemPayload("ddl_10")} onDismiss={() => {}} />,
    );

    const mascot = container.querySelector("img[data-mascot-state]");
    expect(mascot?.getAttribute("data-mascot-state")).toBe("ddl-panic");
    expect(mascot?.getAttribute("data-mascot-animation")).toBe("panic");
    expect(screen.queryByText("占位小角色")).toBeNull();
    expect(screen.queryByText("😟")).toBeNull();
    expect(screen.getByText("距离 DDL 还有 10 分钟")).toBeTruthy();
  });

  it("maps ddl_due and custom reminders through the same contract", () => {
    const { container, rerender } = render(
      <ReminderWindowView payload={systemPayload("ddl_due")} onDismiss={() => {}} />,
    );

    expect(
      container.querySelector("img[data-mascot-state]")?.getAttribute("data-mascot-state"),
    ).toBe("ddl-due");
    expect(
      container
        .querySelector("img[data-mascot-animation]")
        ?.getAttribute("data-mascot-animation"),
    ).toBe("angry");

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
    expect(screen.getByRole("button", { name: "打开任务" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "知道了" })).toBeTruthy();
    expect(container.querySelector(".ws-mascot-frame--md")).toBeTruthy();
    expect(container.querySelector(".ws-mascot-frame--lg")).toBeNull();
  });
});
