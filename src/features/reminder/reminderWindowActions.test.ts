import { beforeEach, describe, expect, it, vi } from "vitest";

import { emitTo } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow, WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  completeTask,
  getTaskById,
  postponeTask,
  updateTask,
} from "../../services/tauri/tasks";
import { REMINDER_TASK_CHANGED_EVENT } from "../../services/tauri/reminder";
import {
  beginTaskFromReminderWindow,
  completeTaskFromReminderWindow,
  postponeTaskFromReminderWindow,
} from "./reminderWindowActions";

const hide = vi.fn(async () => undefined);
const mainWindow = {
  show: vi.fn(async () => undefined),
  unminimize: vi.fn(async () => undefined),
  setFocus: vi.fn(async () => undefined),
};

vi.mock("@tauri-apps/api/event", () => ({
  emitTo: vi.fn(async () => undefined),
  listen: vi.fn(),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: vi.fn(() => ({ hide })),
  WebviewWindow: { getByLabel: vi.fn(async () => mainWindow) },
}));

vi.mock("../../services/tauri/tasks", () => ({
  completeTask: vi.fn(async () => ({})),
  getTaskById: vi.fn(async () => ({ status: "not_started" })),
  postponeTask: vi.fn(async () => ({})),
  updateTask: vi.fn(async () => ({})),
}));

describe("reminderWindowActions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("starts the task, opens it in main, and closes the reminder", async () => {
    await beginTaskFromReminderWindow("task-1");

    expect(getTaskById).toHaveBeenCalledWith("task-1");
    expect(updateTask).toHaveBeenCalledWith({ id: "task-1", status: "in_progress" });
    expect(WebviewWindow.getByLabel).toHaveBeenCalledWith("main");
    expect(emitTo).toHaveBeenCalledWith("main", REMINDER_TASK_CHANGED_EVENT, {
      taskId: "task-1",
    });
    expect(getCurrentWebviewWindow).toHaveBeenCalled();
    expect(hide).toHaveBeenCalled();
  });

  it("postpones with the explosion reason and closes on success", async () => {
    await postponeTaskFromReminderWindow("task-1", 50_000);

    expect(postponeTask).toHaveBeenCalledWith({
      taskId: "task-1",
      newDeadlineAtMs: 50_000,
      reason: "到点爆炸弹窗延期",
    });
    expect(hide).toHaveBeenCalled();
  });

  it("completes the task and closes on success", async () => {
    await completeTaskFromReminderWindow("task-1");
    expect(completeTask).toHaveBeenCalledWith("task-1");
    expect(hide).toHaveBeenCalled();
  });

  it("keeps the reminder open when a mutation fails", async () => {
    vi.mocked(postponeTask).mockRejectedValueOnce(new Error("nope"));

    await expect(postponeTaskFromReminderWindow("task-1", 50_000)).rejects.toThrow("nope");
    expect(emitTo).not.toHaveBeenCalled();
    expect(hide).not.toHaveBeenCalled();
  });
});
