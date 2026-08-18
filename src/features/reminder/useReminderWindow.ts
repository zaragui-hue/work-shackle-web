import { useCallback, useEffect, useState } from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

import {
  REMINDER_WINDOW_SHOW_EVENT,
  type ReminderWindowShowPayload,
} from "../../services/tauri/reminder";

export function useReminderWindow() {
  const [payload, setPayload] = useState<ReminderWindowShowPayload | null>(null);

  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listen<ReminderWindowShowPayload>(REMINDER_WINDOW_SHOW_EVENT, (event) => {
      if (!disposed) {
        setPayload(event.payload);
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
  }, []);

  const dismiss = useCallback(async () => {
    setPayload(null);
    await getCurrentWebviewWindow().hide();
  }, []);

  return {
    payload,
    dismiss,
  };
}
