import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completeTask,
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
  it("shows minute-level core fields and task actions without reminders", async () => {
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
      "🕵️ 接头人",
    ]);
    expect(screen.getByLabelText("开始时间").getAttribute("type")).toBe("datetime-local");
    expect(screen.getByLabelText("开始时间").getAttribute("step")).toBe("60");
    expect(screen.getByLabelText("完成时间").getAttribute("type")).toBe("datetime-local");
    expect(screen.getByLabelText("完成时间").getAttribute("step")).toBe("60");
    expect(await screen.findByRole("progressbar", { name: "时间进度" })).toBeTruthy();
    expect(screen.getByLabelText("主状态")).toBeTruthy();
    expect(screen.queryByText("自定义提醒")).toBeNull();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
    expect(screen.getByRole("button", { name: "取消任务" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "申请延期" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "完成任务" })).toBeTruthy();
    expect(document.querySelector(".ws-drawer__footer .task-drawer__postpone-btn")).toBeTruthy();
    expect(document.querySelector(".task-drawer__management .task-drawer__postpone-btn")).toBeNull();
  });

  it("autosaves every edited core field on blur", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(detail);
    let resolveSave: (task: TaskDetail["task"]) => void = () => undefined;
    vi.mocked(updateTask).mockReturnValue(new Promise((resolve) => {
      resolveSave = resolve;
    }));
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
    fireEvent.change(screen.getByLabelText("🕵️ 接头人"), {
      target: { value: "新对接人" },
    });
    fireEvent.blur(screen.getByLabelText("🕵️ 接头人"));

    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    expect(screen.getByText("正在传递情报…")).toBeTruthy();
    expect(updateTask).toHaveBeenCalledWith(expect.objectContaining({
      id: "task-1",
      title: "改后的任务",
      plannedAtMs: new Date("2026-08-26T10:00").getTime(),
      deadlineAtMs: new Date("2026-08-26T19:00").getTime(),
      priority: 5,
      contactId: null,
      contactSnapshot: "新对接人",
    }));
    resolveSave({ ...detail.task, title: "改后的任务", priority: 5 });
    await screen.findByText("情报已同步");
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("autosaves selects immediately and deduplicates the same snapshot", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(detail);
    vi.mocked(updateTask).mockResolvedValue({ ...detail.task, priority: 5 });
    render(
      <TaskDrawer taskId="task-1" open onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    await screen.findByDisplayValue("整理季度复盘");
    fireEvent.change(screen.getByLabelText("紧急程度"), {
      target: { value: "5" },
    });
    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));

    fireEvent.blur(screen.getByLabelText("任务名称"));
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(updateTask).toHaveBeenCalledTimes(1);
  });

  it("blocks autosave when the time range is invalid", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(detail);
    render(
      <TaskDrawer taskId="task-1" open onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    await screen.findByDisplayValue("整理季度复盘");
    fireEvent.change(screen.getByLabelText("完成时间"), {
      target: { value: "2026-08-26T08:00" },
    });
    fireEvent.blur(screen.getByLabelText("完成时间"));

    expect(await screen.findByText("完成时间必须晚于开始时间")).toBeTruthy();
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("keeps edited input when autosave fails", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(detail);
    vi.mocked(updateTask).mockRejectedValue(new Error("network"));
    render(
      <TaskDrawer taskId="task-1" open onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    await screen.findByDisplayValue("整理季度复盘");
    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "不能丢的修改" },
    });
    fireEvent.blur(screen.getByLabelText("任务名称"));

    expect((await screen.findByRole("alert")).textContent).toContain("任务操作失败");
    expect(screen.getByDisplayValue("不能丢的修改")).toBeTruthy();
  });

  it("waits for autosave before completing the task", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(detail);
    let resolveSave: (task: TaskDetail["task"]) => void = () => undefined;
    vi.mocked(updateTask).mockReturnValue(new Promise((resolve) => {
      resolveSave = resolve;
    }));
    vi.mocked(completeTask).mockResolvedValue({ ...detail.task, status: "completed" });
    render(
      <TaskDrawer taskId="task-1" open onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    await screen.findByDisplayValue("整理季度复盘");
    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "先保存再完成" },
    });
    fireEvent.click(screen.getByRole("button", { name: "完成任务" }));

    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    expect(completeTask).not.toHaveBeenCalled();
    resolveSave({ ...detail.task, title: "先保存再完成" });
    await waitFor(() => expect(completeTask).toHaveBeenCalledWith("task-1"));
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
      "🕵️ 接头人",
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true);
    }
    expect(screen.queryByRole("button", { name: "申请延期" })).toBeNull();
  });
});
