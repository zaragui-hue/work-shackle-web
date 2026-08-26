import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Task, TodayTasks } from "../../services/tauri/tasks";
import { TodayTaskBoard } from "./TodayTaskBoard";

function task(
  id: string,
  title: string,
  status: Task["status"] = "not_started",
): Task {
  return {
    id,
    title,
    plannedAtMs: new Date(2026, 7, 24, 9, 0).getTime(),
    deadlineAtMs: new Date(2026, 7, 24, 18, 0).getTime(),
    priority: 3,
    status,
    createdAtMs: new Date(2026, 7, 24, 8, 0).getTime(),
    updatedAtMs: new Date(2026, 7, 24, 8, 0).getTime(),
  };
}

afterEach(cleanup);

describe("TodayTaskBoard", () => {
  it("does not render an upcoming section or duplicate its tasks", () => {
    const urgent = task("urgent", "马上交稿");
    const tasks: TodayTasks = {
      formalTasks: [urgent],
      upcomingDeadlineTasks: [urgent],
      overdueTasks: [],
      completedTodayTasks: [],
      autoStartedTaskIds: [],
    };

    render(<TodayTaskBoard tasks={tasks} />);

    expect(screen.queryByRole("heading", { name: "即将到点" })).toBeNull();
    expect(screen.getAllByText("马上交稿")).toHaveLength(1);
  });

  it("preserves the formal task order returned by the backend", () => {
    const tasks: TodayTasks = {
      formalTasks: [task("soon", "先完成"), task("later", "后完成")],
      upcomingDeadlineTasks: [],
      overdueTasks: [],
      completedTodayTasks: [],
      autoStartedTaskIds: [],
    };

    render(<TodayTaskBoard tasks={tasks} />);

    const formalList = screen.getByRole("list", { name: "formal" });
    expect(
      within(formalList)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["先完成", "后完成"]);
  });

  it("shows formal tasks without a redundant section heading or hint", () => {
    const tasks: TodayTasks = {
      formalTasks: [task("formal", "完成今日安排")],
      upcomingDeadlineTasks: [],
      overdueTasks: [],
      completedTodayTasks: [],
      autoStartedTaskIds: [],
    };

    render(<TodayTaskBoard tasks={tasks} />);

    expect(screen.queryByText("今天要干")).toBeNull();
    expect(screen.queryByText("今天正式安排")).toBeNull();
    expect(screen.getByRole("list", { name: "formal" })).toBeTruthy();
  });

  it("shows an active stamp and temporary workhorse broadcast for an auto-started task", () => {
    vi.useFakeTimers();
    const started = task("started", "自动开工", "in_progress");
    const tasks: TodayTasks = {
      formalTasks: [started],
      upcomingDeadlineTasks: [],
      overdueTasks: [],
      completedTodayTasks: [],
      autoStartedTaskIds: [started.id],
    };

    render(<TodayTaskBoard tasks={tasks} announcedTaskIds={[started.id]} />);

    expect(screen.getByText("开工了")).toBeTruthy();
    expect(screen.getByLabelText("任务状态：进行中")).toBeTruthy();
    expect(screen.getByText(/打工马播报：时间到了，活自己醒了/)).toBeTruthy();
    expect(screen.getByRole("status")).toBeTruthy();

    act(() => vi.advanceTimersByTime(4_000));
    expect(screen.queryByRole("status")).toBeNull();
    vi.useRealTimers();
  });

  it("does not broadcast a manual in-progress state and allows early dismissal", () => {
    const started = task("manual", "人工开工", "in_progress");
    const tasks: TodayTasks = {
      formalTasks: [started],
      upcomingDeadlineTasks: [],
      overdueTasks: [],
      completedTodayTasks: [],
      autoStartedTaskIds: [],
    };

    const { rerender } = render(<TodayTaskBoard tasks={tasks} />);
    expect(screen.getByText("开工了")).toBeTruthy();
    expect(screen.queryByRole("status")).toBeNull();

    rerender(<TodayTaskBoard tasks={tasks} announcedTaskIds={[started.id]} />);
    fireEvent.click(screen.getByRole("button", { name: "收起开工播报" }));
    expect(screen.queryByRole("status")).toBeNull();
  });
});
