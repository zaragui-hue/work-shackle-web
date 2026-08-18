import { useCallback } from "react";

import { ReminderWindowView } from "../features/reminder/ReminderWindowView";
import "../features/reminder/ReminderWindowView.css";
import { useReminderWindow } from "../features/reminder/useReminderWindow";

export function ReminderWindowApp() {
  const { payload, dismiss } = useReminderWindow();

  const handleDismiss = useCallback(() => {
    void dismiss();
  }, [dismiss]);

  if (!payload) {
    return (
      <div className="reminder-window reminder-window--idle" aria-hidden="true">
        <p className="reminder-window__mascot">提醒窗口待命中…</p>
      </div>
    );
  }

  return <ReminderWindowView payload={payload} onDismiss={handleDismiss} />;
}
