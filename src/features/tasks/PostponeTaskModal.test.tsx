import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { postponeTask } from "../../services/tauri/tasks";
import { PostponeTaskModal } from "./PostponeTaskModal";

vi.mock("../../services/tauri/tasks", () => ({
  postponeTask: vi.fn(),
  mapTaskError: () => "延期失败",
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PostponeTaskModal", () => {
  it("collects the new completion date and minute explicitly", async () => {
    vi.mocked(postponeTask).mockResolvedValue({
      task: {} as never,
      reminders: [],
      postponements: [],
    });
    const onPostponed = vi.fn();
    const onClose = vi.fn();
    const currentDeadlineAtMs = new Date(2026, 7, 26, 18, 0).getTime();
    render(
      <PostponeTaskModal
        open
        taskId="task-1"
        currentDeadlineAtMs={currentDeadlineAtMs}
        plannedAtMs={new Date(2026, 7, 26, 9, 0).getTime()}
        onClose={onClose}
        onPostponed={onPostponed}
      />,
    );

    expect(screen.getByText(/^当前完成时间：/)).toBeTruthy();
    expect((screen.getByLabelText("新完成时间 日期") as HTMLInputElement).value)
      .toBe("2026-08-26");
    expect((screen.getByLabelText("新完成时间 时分") as HTMLInputElement).value)
      .toBe("19:00");

    fireEvent.change(screen.getByLabelText("新完成时间 日期"), {
      target: { value: "2026-08-27" },
    });
    fireEvent.change(screen.getByLabelText("新完成时间 时分"), {
      target: { value: "20:15" },
    });
    fireEvent.change(screen.getByLabelText("延期原因"), {
      target: { value: "外部依赖延迟" },
    });
    fireEvent.click(screen.getByRole("button", { name: "确认延期" }));

    await waitFor(() => expect(postponeTask).toHaveBeenCalledWith({
      taskId: "task-1",
      newDeadlineAtMs: new Date("2026-08-27T20:15").getTime(),
      reason: "外部依赖延迟",
    }));
    expect(onPostponed).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
