import type { LunchReminder } from "../../services/tauri/lunchReminder";
import { Button, Mascot } from "../../shared/ui";
import "./LunchReminderBanner.css";

type LunchReminderBannerProps = {
  reminder: LunchReminder;
  onDismiss: () => void;
  onSwitchToLunch?: () => void;
  switchingToLunch?: boolean;
};

export function LunchReminderBanner({
  reminder,
  onDismiss,
  onSwitchToLunch,
  switchingToLunch = false,
}: LunchReminderBannerProps) {
  return (
    <div className="lunch-reminder" role="status" aria-live="polite">
      <div className="lunch-reminder__content">
        <Mascot
          state="lunch-happy"
          size="sm"
          className="lunch-reminder__mascot"
        />
        <div className="lunch-reminder__text">
          <p className="lunch-reminder__title">到饭点啦</p>
          <p className="lunch-reminder__message">{reminder.message}</p>
          <p className="lunch-reminder__time">
            午餐时间 {reminder.lunchStart} - {reminder.lunchEnd}
          </p>
        </div>
      </div>
      <div className="lunch-reminder__actions">
        {onSwitchToLunch ? (
          <Button
            variant="secondary"
            onClick={onSwitchToLunch}
            disabled={switchingToLunch}
          >
            {switchingToLunch ? "切换中…" : "切换为午餐中"}
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onDismiss}>
          知道了
        </Button>
      </div>
    </div>
  );
}
