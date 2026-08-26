import { beforeEach, describe, expect, it, vi } from "vitest";

import { cancelTask, completeTask, updateTask } from "../../services/tauri/tasks";
import { changeTaskStatus } from "./taskStatusActions";

vi.mock("../../services/tauri/tasks", () => ({
  cancelTask: vi.fn(),
  completeTask: vi.fn(),
  updateTask: vi.fn(),
}));

beforeEach(() => vi.clearAllMocks());

describe("changeTaskStatus", () => {
  it("uses a regular update for nonterminal states", async () => {
    await changeTaskStatus("task-1", "paused");
    expect(updateTask).toHaveBeenCalledWith({ id: "task-1", status: "paused" });
    expect(completeTask).not.toHaveBeenCalled();
    expect(cancelTask).not.toHaveBeenCalled();
  });

  it("uses the timestamp-aware completion action", async () => {
    await changeTaskStatus("task-1", "completed");
    expect(completeTask).toHaveBeenCalledWith("task-1");
    expect(updateTask).not.toHaveBeenCalled();
  });

  it("uses the timestamp-aware cancellation action", async () => {
    await changeTaskStatus("task-1", "cancelled");
    expect(cancelTask).toHaveBeenCalledWith("task-1");
    expect(updateTask).not.toHaveBeenCalled();
  });
});
