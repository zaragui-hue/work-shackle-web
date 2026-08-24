import { Button, Mascot } from "../../shared/ui";
import { reminderStatusLabel, type WorkdayReminder } from "./workdayReminders";
import "./WorkdayReminderPrompt.css";

export function WorkdayReminderPrompt({
  reminder,
  switching,
  onSwitch,
  onDismiss,
}: {
  reminder: WorkdayReminder;
  switching: boolean;
  onSwitch: () => void;
  onDismiss: () => void;
}) {
  return (
    <section className="workday-reminder-prompt" role="alertdialog" aria-label="上班提醒">
      <Mascot
        state="ddl-panic"
        size="sm"
        animation="panic"
        className="workday-reminder-prompt__icon"
      />
      <div className="workday-reminder-prompt__copy">
        <p className="workday-reminder-prompt__kicker">{reminder.time} · {reminder.label}</p>
        <h2>{reminder.message}</h2>
        <p>建议切换为「{reminderStatusLabel(reminder.suggestedStatus)}」，当然最终解释权归你。</p>
      </div>
      <div className="workday-reminder-prompt__actions">
        <Button disabled={switching} onClick={onSwitch}>
          {switching ? "切换中…" : "切换状态"}
        </Button>
        <Button variant="secondary" disabled={switching} onClick={onDismiss}>先这样吧</Button>
      </div>
    </section>
  );
}
