import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CalendarDayDrawer } from "./CalendarDayDrawer";

const mockUseCalendarDayTasks = vi.fn();

vi.mock("./useCalendarDayTasks", () => ({
  useCalendarDayTasks: (...args: unknown[]) => mockUseCalendarDayTasks(...args),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CalendarDayDrawer", () => {
  it("shows the drawer title with date and task count", () => {
    mockUseCalendarDayTasks.mockReturnValue({
      dayTasks: {
        date: "2026-08-18",
        formalTasks: [{ id: "task-1", title: "Task A" }],
        overdueTasks: [],
        completedTasks: [],
        cancelledTasks: [],
      },
      loading: false,
      error: null,
    });

    render(
      <CalendarDayDrawer
        dateKey="2026-08-18"
        open
        onClose={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "8 月 18 日 · 1 个任务" })).toBeTruthy();
  });

  it("shows an empty state when there are no tasks", () => {
    mockUseCalendarDayTasks.mockReturnValue({
      dayTasks: {
        date: "2026-08-18",
        formalTasks: [],
        overdueTasks: [],
        completedTasks: [],
        cancelledTasks: [],
      },
      loading: false,
      error: null,
    });

    render(
      <CalendarDayDrawer
        dateKey="2026-08-18"
        open
        onClose={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );

    expect(screen.getByText("这天居然没安排")).toBeTruthy();
  });

  it("shows a loading status while fetching", () => {
    mockUseCalendarDayTasks.mockReturnValue({
      dayTasks: null,
      loading: true,
      error: null,
    });

    render(
      <CalendarDayDrawer
        dateKey="2026-08-18"
        open
        onClose={vi.fn()}
        onSelectTask={vi.fn()}
      />,
    );

    expect(screen.getByText("加载当天任务中…")).toBeTruthy();
  });

  it("closes before opening task detail when a task is selected", () => {
    const onClose = vi.fn();
    const onSelectTask = vi.fn();

    mockUseCalendarDayTasks.mockReturnValue({
      dayTasks: {
        date: "2026-08-18",
        formalTasks: [
          {
            id: "task-1",
            title: "Task A",
            plannedAtMs: 0,
            priority: 2,
            status: "not_started",
            createdAtMs: 0,
            updatedAtMs: 0,
          },
        ],
        overdueTasks: [],
        completedTasks: [],
        cancelledTasks: [],
      },
      loading: false,
      error: null,
    });

    render(
      <CalendarDayDrawer
        dateKey="2026-08-18"
        open
        onClose={onClose}
        onSelectTask={onSelectTask}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Task A/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSelectTask).toHaveBeenCalledWith("task-1");
  });

  it("can be closed from the drawer header", () => {
    mockUseCalendarDayTasks.mockReturnValue({
      dayTasks: null,
      loading: false,
      error: null,
    });
    const onClose = vi.fn();

    render(
      <CalendarDayDrawer
        dateKey="2026-08-18"
        open
        onClose={onClose}
        onSelectTask={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "关闭" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
