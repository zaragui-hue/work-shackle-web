import { Button, Mascot } from "../../shared/ui";
import type { WorkdayStatusNotice as Notice } from "./useWorkdayStatusAutomation";
import "./WorkdayStatusNotice.css";

export function WorkdayStatusNotice({
  notice,
  switching,
  onRetry,
  onDismiss,
}: {
  notice: Notice;
  switching: boolean;
  onRetry?: () => void;
  onDismiss: () => void;
}) {
  return (
    <section
      className={`workday-status-notice workday-status-notice--${notice.tone}`}
      role="status"
      aria-live="polite"
    >
      <Mascot
        state={notice.tone === "success" ? "work-neutral" : "ddl-anxious"}
        animation={notice.tone === "success" ? "breathe" : "shake"}
        size="sm"
        className="workday-status-notice__mascot"
      />
      <div className="workday-status-notice__copy">
        <strong>{notice.title}</strong>
        <span>{notice.message}</span>
      </div>
      <div className="workday-status-notice__actions">
        {onRetry ? (
          <Button disabled={switching} onClick={onRetry}>
            {switching ? "重试中…" : "重试"}
          </Button>
        ) : null}
        <button type="button" onClick={onDismiss} aria-label="关闭状态通知">×</button>
      </div>
    </section>
  );
}
