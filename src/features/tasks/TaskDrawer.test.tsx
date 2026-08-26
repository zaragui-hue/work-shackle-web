import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getTaskDetail,
  updateTask,
  type TaskDetail,
} from "../../services/tauri/tasks";
import { TaskDrawer } from "./TaskDrawer";

vi.mock("../../services/tauri/tasks", () => ({
  cancelTask: vi.fn(),
  completeTask: vi.fn(),
  getTaskDetail: vi.fn(),
  updateTask: vi.fn(),
  mapTaskError: () => "任务操作失败",
}));

vi.mock("../../services/tauri/ddl", () => ({
  computeDdlProgress: vi.fn().mockResolvedValue({
    progressRatio: 0.5,
    remainingMs: 60_000,
    isOverdue: false,
    emotion: "anxious",
  }),
}));

const detail: TaskDetail = {
  task: {
    id: "task-1",
    title: "整理季度复盘",
    note: "带数据",
    plannedAtMs: new Date(2026, 7, 26, 9, 0).getTime(),
    deadlineAtMs: new Date(2026, 7, 26, 18, 0).getTime(),
    priority: 4,
    status: "in_progress",
    contactId: "contact-1",
    contactSnapshot: "小王",
    createdAtMs: new Date(2026, 7, 25, 9, 0).getTime(),
    updatedAtMs: new Date(2026, 7, 25, 9, 0).getTime(),
  },
  reminders: [],
  postponements: [],
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TaskDrawer", () => {
  it("shows the same ordered core fields as task creation", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(detail);
    render(
      <TaskDrawer taskId="task-1" open onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    await screen.findByDisplayValue("整理季度复盘");

    expect(
      Array.from(document.querySelectorAll(".ws-field__label"))
        .slice(0, 6)
        .map((label) => label.textContent?.trim()),
    ).toEqual([
      "任务名称",
      "备注",
      "开始时间",
      "完成时间",
      "紧急程度",
      "对接人",
    ]);
    expect(await screen.findByRole("progressbar", { name: "时间进度" })).toBeTruthy();
    expect(screen.getByLabelText("主状态")).toBeTruthy();
    expect(screen.getByRole("button", { name: "延期" })).toBeTruthy();
    expect(screen.getByText("自定义提醒")).toBeTruthy();
  });

  it("saves every edited core field", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(detail);
    vi.mocked(updateTask).mockResolvedValue(detail.task);
    const onChanged = vi.fn();
    render(
      <TaskDrawer taskId="task-1" open onClose={vi.fn()} onChanged={onChanged} />,
    );

    await screen.findByDisplayValue("整理季度复盘");
    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "改后的任务" },
    });
    fireEvent.change(screen.getByLabelText("开始时间"), {
      target: { value: "2026-08-26T10:00" },
    });
    fireEvent.change(screen.getByLabelText("完成时间"), {
      target: { value: "2026-08-26T19:00" },
    });
    fireEvent.change(screen.getByLabelText("紧急程度"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("对接人"), {
      target: { value: "新对接人" },
    });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    expect(updateTask).toHaveBeenCalledWith(expect.objectContaining({
      id: "task-1",
      title: "改后的任务",
      plannedAtMs: new Date("2026-08-26T10:00").getTime(),
      deadlineAtMs: new Date("2026-08-26T19:00").getTime(),
      priority: 5,
      contactId: null,
      contactSnapshot: "新对接人",
    }));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("keeps terminal task core fields read-only", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue({
      ...detail,
      task: { ...detail.task, status: "completed" },
    });
    render(
      <TaskDrawer taskId="task-1" open onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    await screen.findByDisplayValue("整理季度复盘");
    for (const label of [
      "任务名称",
      "备注",
      "开始时间",
      "完成时间",
      "紧急程度",
      "对接人",
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true);
    }
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
    expect(screen.queryByRole("button", { name: "延期" })).toBeNull();
  });
});
