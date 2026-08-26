import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";

import { Mascot } from "../../shared/ui";
import "./TaskAutoStartBroadcast.css";

const AUTO_DISMISS_MS = 4_000;

type TaskAutoStartBroadcastProps = {
  plannedAtMs: number;
  onDismiss: () => void;
};

export function TaskAutoStartBroadcast({
  plannedAtMs,
  onDismiss,
}: TaskAutoStartBroadcastProps) {
  const [visible, setVisible] = useState(true);
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  const dismiss = useCallback(() => {
    setVisible(false);
    onDismissRef.current();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [dismiss]);

  if (!visible) {
    return null;
  }

  return (
    <div className="task-auto-start-broadcast" role="status" aria-live="polite">
      <Mascot
        state="work-neutral"
        animation="breathe"
        size="sm"
        className="task-auto-start-broadcast__mascot"
      />
      <div className="task-auto-start-broadcast__copy">
        <strong className="task-auto-start-broadcast__copy--desktop">
          打工马播报：时间到了，活自己醒了。
        </strong>
        <strong className="task-auto-start-broadcast__copy--mobile">
          时间到了，自动开工。
        </strong>
        <span>{format(new Date(plannedAtMs), "HH:mm")} · 自动切换</span>
      </div>
      <button type="button" onClick={dismiss} aria-label="收起开工播报">
        ×
      </button>
    </div>
  );
}
