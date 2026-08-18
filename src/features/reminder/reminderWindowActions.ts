import { useCallback, useEffect } from "react";
import { emitTo, listen } from "@tauri-apps/api/event";
import {
  getCurrentWebviewWindow,
  WebviewWindow,
} from "@tauri-apps/api/webviewWindow";

import {
  REMINDER_OPEN_TASK_EVENT,
  type ReminderOpenTaskPayload,
} from "../../services/tauri/reminder";

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

export function useReminderOpenTaskBridge(onOpenTask: (taskId: string) => void) {
  const stableOpenTask = useCallback(onOpenTask, [onOpenTask]);
  useReminderOpenTask({ onOpenTask: stableOpenTask });
}
