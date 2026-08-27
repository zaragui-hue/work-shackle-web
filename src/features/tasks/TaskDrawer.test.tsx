import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  completeTask,
  getTaskDetail,
  updateTask,
  type TaskDetail,
} from "../../services/tauri/tasks";
import { TaskDrawer } from "./TaskDrawer";
import { msToDatetimeLocal } from "./taskDisplay";

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

function futureNotStartedDetail(): TaskDetail {
  const planned = new Date();
  planned.setDate(planned.getDate() + 1);
  planned.setHours(9, 0, 0, 0);
  const deadline = new Date(planned);
  deadline.setHours(18, 0, 0, 0);
  return {
    ...detail,
    task: {
      ...detail.task,
      status: "not_started",
      plannedAtMs: planned.getTime(),
      deadlineAtMs: deadline.getTime(),
    },
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
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
    expect(screen.getByLabelText("开始时间 日期").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("开始时间 小时").tagName).toBe("SELECT");
    expect(screen.getByLabelText("开始时间 分钟").tagName).toBe("SELECT");
    expect(screen.getByLabelText("完成时间 日期").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("完成时间 小时").tagName).toBe("SELECT");
    expect(screen.getByLabelText("完成时间 分钟").tagName).toBe("SELECT");
    expect((screen.getByLabelText("开始时间 日期") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("完成时间 分钟") as HTMLSelectElement).disabled).toBe(true);
    expect(document.querySelector(".task-core-fields__time-range--disabled")).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "时间进度" })).toBeNull();
    expect(screen.queryByLabelText("主状态")).toBeNull();
    expect(screen.queryByText("任务管理")).toBeNull();
    expect(screen.queryByText("自定义提醒")).toBeNull();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
    expect(screen.getByRole("button", { name: "取消任务" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "申请延期" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "完成任务" })).toBeTruthy();
    expect(document.querySelector(".ws-drawer__footer .task-drawer__postpone-btn")).toBeTruthy();
    expect(document.querySelector(".task-drawer__management .task-drawer__postpone-btn")).toBeNull();
  });

  it("autosaves editable started-task fields without time or status", async () => {
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
    fireEvent.change(screen.getByLabelText("紧急程度"), {
      target: { value: "5" },
    });
    fireEvent.change(screen.getByLabelText("🕵️ 接头人"), {
      target: { value: "新对接人" },
    });
    fireEvent.blur(screen.getByLabelText("🕵️ 接头人"));

    await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
    expect(updateTask).toHaveBeenCalledWith({
      id: "task-1",
      title: "改后的任务",
      note: "带数据",
      priority: 5,
      contactId: null,
      contactSnapshot: "新对接人",
    });
    resolveSave({ ...detail.task, title: "改后的任务", priority: 5 });
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("情报已同步")).toBeNull();
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it("autosaves date and minute edits before the task starts", async () => {
    const notStarted = futureNotStartedDetail();
    const nextStart = new Date(notStarted.task.plannedAtMs);
    nextStart.setDate(nextStart.getDate() + 1);
    nextStart.setHours(10, 0, 0, 0);
    const nextEnd = new Date(nextStart);
    nextEnd.setHours(19, 0, 0, 0);
    const [startDate, startTime] = msToDatetimeLocal(nextStart.getTime()).split("T");
    const [endDate, endTime] = msToDatetimeLocal(nextEnd.getTime()).split("T");
    vi.mocked(getTaskDetail).mockResolvedValue(notStarted);
    vi.mocked(updateTask).mockResolvedValue({
      ...notStarted.task,
      plannedAtMs: nextStart.getTime(),
      deadlineAtMs: nextEnd.getTime(),
    });
    render(<TaskDrawer taskId="task-1" open onClose={vi.fn()} onChanged={vi.fn()} />);

    await screen.findByDisplayValue("整理季度复盘");
    fireEvent.change(screen.getByLabelText("开始时间 日期"), {
      target: { value: startDate },
    });
    const [startHour, startMinute] = startTime.split(":");
    const [endHour, endMinute] = endTime.split(":");
    fireEvent.change(screen.getByLabelText("开始时间 小时"), {
      target: { value: startHour },
    });
    fireEvent.change(screen.getByLabelText("开始时间 分钟"), {
      target: { value: startMinute },
    });
    fireEvent.change(screen.getByLabelText("完成时间 日期"), {
      target: { value: endDate },
    });
    fireEvent.change(screen.getByLabelText("完成时间 小时"), {
      target: { value: endHour },
    });
    fireEvent.change(screen.getByLabelText("完成时间 分钟"), {
      target: { value: endMinute },
    });
    fireEvent.blur(screen.getByLabelText("完成时间 分钟"));

    await waitFor(() => expect(updateTask).toHaveBeenCalledWith(expect.objectContaining({
      plannedAtMs: nextStart.getTime(),
      deadlineAtMs: nextEnd.getTime(),
    })));
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

  it("prevents choosing a completion time before the start time", async () => {
    vi.mocked(getTaskDetail).mockResolvedValue(futureNotStartedDetail());
    render(
      <TaskDrawer taskId="task-1" open onClose={vi.fn()} onChanged={vi.fn()} />,
    );

    await screen.findByDisplayValue("整理季度复盘");
    const hour = screen.getByLabelText("完成时间 小时") as HTMLSelectElement;
    expect(hour.querySelector('option[value="08"]')?.disabled).toBe(true);
    expect(hour.querySelector('option[value="09"]')?.disabled).toBe(false);
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
      "紧急程度",
      "🕵️ 接头人",
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true);
    }
    for (const label of [
      "开始时间 日期",
      "开始时间 小时",
      "开始时间 分钟",
      "完成时间 日期",
      "完成时间 小时",
      "完成时间 分钟",
    ]) {
      expect((screen.getByLabelText(label) as HTMLInputElement).disabled).toBe(true);
    }
    expect(document.querySelector(".task-core-fields__time-range--disabled")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "申请延期" })).toBeNull();
  });
});
