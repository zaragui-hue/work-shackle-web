import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { Task, TodayTasks } from "../../domain/model";
import { TodayTaskBoard } from "./TodayTaskBoard";

const now = new Date(2026, 7, 28, 10).getTime();
const task: Task = { id: "task-1", title: "准备周会", plannedAtMs: now, deadlineAtMs: now + 3_600_000, priority: 2, status: "in_progress", createdAtMs: now, updatedAtMs: now };
const today: TodayTasks = { formalTasks: [task], overdueTasks: [], completedTodayTasks: [], autoStartedTaskIds: [] };

describe("TodayTaskBoard", () => {
  it("keeps task creation and action callbacks", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    const onPostpone = vi.fn();
    render(<TodayTaskBoard today={today} nowMs={now} onCreate={onCreate} onEdit={vi.fn()} onPostpone={onPostpone} onStatus={vi.fn()} onPriority={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /新建任务/ }));
    await user.click(screen.getByRole("button", { name: "申请延期" }));
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onPostpone).toHaveBeenCalledWith(task);
    expect(screen.getByText("正在发生")).toBeVisible();
  });
});
