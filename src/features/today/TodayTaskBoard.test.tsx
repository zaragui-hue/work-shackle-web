import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Task, TodayTasks } from "../../services/tauri/tasks";
import { TodayTaskBoard } from "./TodayTaskBoard";

function task(id: string, title: string): Task {
  return {
    id,
    title,
    plannedAtMs: new Date(2026, 7, 24, 9, 0).getTime(),
    deadlineAtMs: new Date(2026, 7, 24, 18, 0).getTime(),
    priority: 3,
    status: "not_started",
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
    };

    render(<TodayTaskBoard tasks={tasks} />);

    const formalList = screen.getByRole("list", { name: "formal" });
    expect(
      within(formalList)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["先完成", "后完成"]);
  });
});
