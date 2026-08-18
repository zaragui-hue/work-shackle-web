import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskCalendar } from "./TaskCalendar";

const mockUseCalendarTaskCounts = vi.fn();

vi.mock("./useCalendarTaskCounts", () => ({
  useCalendarTaskCounts: (...args: unknown[]) => mockUseCalendarTaskCounts(...args),
}));

const mockCalendarDayDrawer = vi.fn();

vi.mock("./CalendarDayDrawer", () => ({
  CalendarDayDrawer: (props: {
    dateKey: string | null;
    open: boolean;
    onClose: () => void;
    onSelectTask: (taskId: string) => void;
  }) => {
    mockCalendarDayDrawer(props);
    if (!props.open) {
      return null;
    }
    return (
      <div role="dialog" aria-label={`day-drawer-${props.dateKey ?? "none"}`}>
        <button type="button" onClick={props.onClose}>
          关闭日期抽屉
        </button>
      </div>
    );
  },
}));

const FIXED_TODAY = new Date(2026, 7, 18);
const AUGUST_2026 = new Date(2026, 7, 1);

function mockCounts(
  countsByDate: Record<string, number>,
  options: { loading?: boolean; error?: string | null } = {},
) {
  mockUseCalendarTaskCounts.mockReturnValue({
    countsByDate,
    loading: options.loading ?? false,
    error: options.error ?? null,
  });
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

beforeEach(() => {
  mockCounts({});
});

describe("TaskCalendar", () => {
  it("shows the current month title", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    expect(screen.getByRole("heading", { level: 3, name: "2026 年 8 月" })).toBeTruthy();
  });

  it("moves to the previous month", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    fireEvent.click(screen.getByRole("button", { name: "上一个月" }));

    expect(screen.getByRole("heading", { level: 3, name: "2026 年 7 月" })).toBeTruthy();
  });

  it("moves to the next month", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    fireEvent.click(screen.getByRole("button", { name: "下一个月" }));

    expect(screen.getByRole("heading", { level: 3, name: "2026 年 9 月" })).toBeTruthy();
  });

  it("returns to today's month", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    fireEvent.click(screen.getByRole("button", { name: "下一个月" }));
    fireEvent.click(screen.getByRole("button", { name: "下一个月" }));
    expect(screen.getByRole("heading", { level: 3, name: "2026 年 10 月" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "回到今天" }));

    expect(screen.getByRole("heading", { level: 3, name: "2026 年 8 月" })).toBeTruthy();
  });

  it("applies today styling to the current local day", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    const todayCell = screen.getByRole("gridcell", { name: /2026年8月18日/ });
    expect(todayCell.className).toContain("task-calendar__day--today");
    expect(todayCell.getAttribute("aria-current")).toBe("date");
  });

  it("applies outside-month styling to padding days", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    const outsideCell = screen.getByRole("gridcell", { name: "2026年7月27日" });
    expect(outsideCell.className).toContain("task-calendar__day--outside");
    expect(outsideCell.textContent).not.toContain("个任务");
  });

  it("shows task count, emoji and busy name for current-month days", () => {
    mockCounts({ "2026-08-18": 5 });

    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    const busyCell = screen.getByRole("gridcell", { name: /2026年8月18日，5 个任务，🙂 正常/ });
    expect(busyCell.textContent).toContain("5 个任务");
    expect(busyCell.textContent).toContain("🙂");
    expect(busyCell.textContent).toContain("正常");
  });

  it("shows idle busy state when count is zero", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    const idleCell = screen.getByRole("gridcell", { name: /2026年8月18日，0 个任务，🫧 空闲/ });
    expect(idleCell.textContent).toContain("0 个任务");
    expect(idleCell.textContent).toContain("🫧");
    expect(idleCell.textContent).toContain("空闲");
  });

  it("re-queries counts when the visible month changes", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    expect(mockUseCalendarTaskCounts).toHaveBeenCalledWith("2026-07-27", "2026-09-06");

    fireEvent.click(screen.getByRole("button", { name: "下一个月" }));

    expect(mockUseCalendarTaskCounts).toHaveBeenLastCalledWith("2026-08-31", "2026-10-04");
  });

  it("shows a loading status without removing the calendar grid", () => {
    mockCounts({}, { loading: true });

    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    expect(screen.getByText("加载任务数量中…")).toBeTruthy();
    expect(screen.getByRole("grid", { name: "2026 年 8 月" })).toBeTruthy();
    expect(screen.queryByText("0 个任务")).toBeNull();
  });

  it("shows an error status without crashing the calendar", () => {
    mockCounts({}, { error: "加载日历任务数量失败" });

    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    expect(screen.getByRole("alert").textContent).toContain("加载日历任务数量失败");
    expect(screen.getByRole("grid", { name: "2026 年 8 月" })).toBeTruthy();
    expect(screen.queryByText("0 个任务")).toBeNull();
  });

  it("opens the day drawer when a date cell is clicked", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    fireEvent.click(screen.getByRole("gridcell", { name: /2026年8月18日/ }));

    expect(screen.getByRole("dialog", { name: "day-drawer-2026-08-18" })).toBeTruthy();
    expect(mockCalendarDayDrawer).toHaveBeenLastCalledWith(
      expect.objectContaining({
        dateKey: "2026-08-18",
        open: true,
      }),
    );
  });

  it("can open the day drawer for outside-month padding dates", () => {
    render(<TaskCalendar today={FIXED_TODAY} initialMonth={AUGUST_2026} />);

    fireEvent.click(screen.getByRole("gridcell", { name: "2026年7月27日" }));

    expect(screen.getByRole("dialog", { name: "day-drawer-2026-07-27" })).toBeTruthy();
  });
});
