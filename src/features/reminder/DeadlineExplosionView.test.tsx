import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ReminderWindowShowPayload } from "../../services/tauri/reminder";
import {
  beginTaskFromReminderWindow,
  completeTaskFromReminderWindow,
  postponeTaskFromReminderWindow,
} from "./reminderWindowActions";
import { DeadlineExplosionView } from "./DeadlineExplosionView";

vi.mock("./reminderWindowActions", () => ({
  beginTaskFromReminderWindow: vi.fn(async () => undefined),
  postponeTaskFromReminderWindow: vi.fn(async () => undefined),
  completeTaskFromReminderWindow: vi.fn(async () => undefined),
}));

const payload: ReminderWindowShowPayload = {
  primary: {
    kind: "system",
    taskId: "task-1",
    taskTitle: "提交方案",
    reminderKind: "ddl_due",
    deadlineSnapshotMs: new Date(2026, 7, 27, 18, 0).getTime(),
    triggerAtMs: new Date(2026, 7, 27, 18, 0).getTime(),
    firedAtMs: new Date(2026, 7, 27, 18, 0).getTime(),
  },
  additionalCount: 2,
};

describe("DeadlineExplosionView", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(cleanup);

  it("shows the incident, deadline, and grouped task count", () => {
    render(<DeadlineExplosionView payload={payload} />);

    expect(screen.getByRole("dialog", { name: "提交方案" })).toBeTruthy();
    expect(screen.getByText("DDL 已归零 · 现在不是演习")).toBeTruthy();
    expect(screen.getByText("18:00")).toBeTruthy();
    expect(screen.getByText("还有 2 个任务也炸了")).toBeTruthy();
  });

  it("runs begin and complete actions directly", async () => {
    render(<DeadlineExplosionView payload={payload} />);

    fireEvent.click(screen.getByRole("button", { name: "现在处理" }));
    await waitFor(() =>
      expect(beginTaskFromReminderWindow).toHaveBeenCalledWith("task-1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "结束任务" }));
    await waitFor(() =>
      expect(completeTaskFromReminderWindow).toHaveBeenCalledWith("task-1"),
    );
  });

  it("expands the native time picker and confirms postponement", async () => {
    render(<DeadlineExplosionView payload={payload} />);

    fireEvent.click(screen.getByRole("button", { name: "延期" }));
    const input = screen.getByLabelText("新的截止时间");
    fireEvent.change(input, { target: { value: "23:59" } });
    fireEvent.click(screen.getByRole("button", { name: "确认延期" }));

    await waitFor(() => {
      expect(postponeTaskFromReminderWindow).toHaveBeenCalledWith(
        "task-1",
        expect.any(Number),
      );
    });
  });

  it("keeps an actionable error visible when a task action fails", async () => {
    vi.mocked(completeTaskFromReminderWindow).mockRejectedValueOnce({
      code: "DATABASE_ERROR",
      details: { message: "nope" },
    });
    render(<DeadlineExplosionView payload={payload} />);

    fireEvent.click(screen.getByRole("button", { name: "结束任务" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "数据库操作失败，弹窗先留着，请再试一次。",
    );
  });
});
