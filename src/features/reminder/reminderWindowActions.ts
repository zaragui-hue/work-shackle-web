import { useCallback, useEffect } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import {
  getCurrentWebviewWindow,
  WebviewWindow,
} from "@tauri-apps/api/webviewWindow";

import {
  REMINDER_OPEN_TASK_EVENT,
  REMINDER_TASK_CHANGED_EVENT,
  type ReminderOpenTaskPayload,
} from "../../services/tauri/reminder";
import {
  completeTask,
  getTaskById,
  postponeTask,
  updateTask,
} from "../../services/tauri/tasks";

type UseReminderOpenTaskOptions = {
  onOpenTask: (taskId: string) => void;
};

export function useReminderOpenTask({ onOpenTask }: UseReminderOpenTaskOptions) {
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<ReminderOpenTaskPayload>(REMINDER_OPEN_TASK_EVENT, (event) => {
      if (!disposed) {
        onOpenTask(event.payload.taskId);
      }
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }
      unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [onOpenTask]);
}

export async function openTaskFromReminderWindow(taskId: string): Promise<void> {
  const main = await WebviewWindow.getByLabel("main");
  if (!main) {
    throw new Error("main window not found");
  }
  await main.show();
  await main.unminimize();
  await main.setFocus();
  await emitTo("main", REMINDER_OPEN_TASK_EVENT, { taskId });
  await getCurrentWebviewWindow().hide();
}

async function hideReminderWindow(): Promise<void> {
  await getCurrentWebviewWindow().hide();
}

async function notifyTaskChanged(taskId: string): Promise<void> {
  await emitTo("main", REMINDER_TASK_CHANGED_EVENT, { taskId });
}

export async function beginTaskFromReminderWindow(taskId: string): Promise<void> {
  const task = await getTaskById(taskId);
  if (task.status !== "in_progress") {
    await updateTask({ id: taskId, status: "in_progress" });
  }
  await notifyTaskChanged(taskId);
  await openTaskFromReminderWindow(taskId);
}

export async function postponeTaskFromReminderWindow(
  taskId: string,
  newDeadlineAtMs: number,
): Promise<void> {
  await postponeTask({
    taskId,
    newDeadlineAtMs,
    reason: "到点爆炸弹窗延期",
  });
  await notifyTaskChanged(taskId);
  await hideReminderWindow();
}

export async function completeTaskFromReminderWindow(
  taskId: string,
): Promise<void> {
  await completeTask(taskId);
  await notifyTaskChanged(taskId);
  await hideReminderWindow();
}

export function useReminderOpenTaskBridge(onOpenTask: (taskId: string) => void) {
  const stableOpenTask = useCallback(onOpenTask, [onOpenTask]);
  useReminderOpenTask({ onOpenTask: stableOpenTask });
}
