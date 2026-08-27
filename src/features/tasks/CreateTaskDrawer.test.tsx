import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTask } from "../../services/tauri/tasks";
import { CreateTaskDrawer } from "./CreateTaskDrawer";

vi.mock("../../services/tauri/tasks", () => ({
  createTask: vi.fn(),
  mapTaskError: () => "创建失败",
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("CreateTaskDrawer", () => {
  it("renders the create form in a right-side drawer", () => {
    render(<CreateTaskDrawer open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "新建任务" })).toBeTruthy();
    expect(document.querySelector(".ws-drawer__panel")).toBeTruthy();
    expect(document.querySelector(".ws-modal__panel")).toBeNull();
    expect(screen.getByLabelText("开始时间 日期").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("开始时间 小时").tagName).toBe("SELECT");
    expect(screen.getByLabelText("开始时间 分钟").tagName).toBe("SELECT");
    expect(screen.getByLabelText("完成时间 日期").getAttribute("type")).toBe("date");
    expect(screen.getByLabelText("完成时间 小时").tagName).toBe("SELECT");
    expect(screen.getByLabelText("完成时间 分钟").tagName).toBe("SELECT");
    expect((screen.getByLabelText("紧急程度") as HTMLSelectElement).value).toBe("2");
    expect(screen.getByLabelText("🕵️ 接头人").getAttribute("placeholder"))
      .toBe("输入本次行动的秘密联络人");
    expect(screen.queryByText("自定义提醒")).toBeNull();
    expect(
      Array.from(document.querySelectorAll(".ws-field__label")).map((label) =>
        label.textContent?.trim(),
      ),
    ).toEqual([
      "任务名称",
      "备注",
      "开始时间",
      "完成时间",
      "紧急程度",
      "🕵️ 接头人",
    ]);
  });

  it("closes from the drawer footer", () => {
    const onClose = vi.fn();
    render(<CreateTaskDrawer open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("notifies the page and closes after a successful creation", async () => {
    const created = {
      id: "task-1",
      title: "抽屉新任务",
      plannedAtMs: Date.now(),
      priority: 2,
      status: "not_started" as const,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    vi.mocked(createTask).mockResolvedValue(created);
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(
      <CreateTaskDrawer open onClose={onClose} onCreated={onCreated} />,
    );

    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "抽屉新任务" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calibrates an untouched default start time when submission crosses a minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 27, 18, 17, 0));
    vi.mocked(createTask).mockResolvedValue({
      id: "task-calibrated",
      title: "跨分钟任务",
      plannedAtMs: new Date(2026, 7, 27, 18, 18).getTime(),
      deadlineAtMs: new Date(2026, 7, 28, 18, 0).getTime(),
      priority: 2,
      status: "not_started",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    render(<CreateTaskDrawer open onClose={vi.fn()} />);

    vi.setSystemTime(new Date(2026, 7, 27, 18, 18, 0));
    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "跨分钟任务" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedAtMs: new Date(2026, 7, 27, 18, 18).getTime(),
      }),
    );
  });

  it("does not overwrite a start time the user changed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 27, 18, 17, 0));
    vi.mocked(createTask).mockResolvedValue({
      id: "task-edited",
      title: "主动改时间",
      plannedAtMs: new Date(2026, 7, 27, 18, 30).getTime(),
      deadlineAtMs: new Date(2026, 7, 28, 18, 0).getTime(),
      priority: 2,
      status: "not_started",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    render(<CreateTaskDrawer open onClose={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("开始时间 分钟"), {
      target: { value: "30" },
    });
    vi.setSystemTime(new Date(2026, 7, 27, 18, 18, 0));
    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "主动改时间" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedAtMs: new Date(2026, 7, 27, 18, 30).getTime(),
      }),
    );
  });

  it("moves completion one minute forward when calibration overtakes it", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 27, 17, 59, 0));
    vi.mocked(createTask).mockResolvedValue({
      id: "task-range",
      title: "校准时间段",
      plannedAtMs: new Date(2026, 7, 27, 18, 1).getTime(),
      deadlineAtMs: new Date(2026, 7, 27, 18, 2).getTime(),
      priority: 2,
      status: "not_started",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    });
    render(<CreateTaskDrawer open onClose={vi.fn()} />);

    vi.setSystemTime(new Date(2026, 7, 27, 18, 1, 0));
    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "校准时间段" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));

    await act(async () => {
      await Promise.resolve();
    });
    expect(createTask).toHaveBeenCalledWith(
      expect.objectContaining({
        plannedAtMs: new Date(2026, 7, 27, 18, 1).getTime(),
        deadlineAtMs: new Date(2026, 7, 27, 18, 2).getTime(),
      }),
    );
  });
});
