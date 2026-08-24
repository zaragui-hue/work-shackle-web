import {
  mascotAnimationForReminderKind,
  mascotStateForReminderKind,
} from "../../assets/mascot";
import type { ReminderWindowShowPayload } from "../../services/tauri/reminder";
import { Button, Mascot } from "../../shared/ui";
import {
  additionalTasksLabel,
  reminderEmotion,
  reminderHeadline,
  reminderKindLabel,
  reminderRemainingLabel,
} from "./reminderWindowCopy";
import { openTaskFromReminderWindow } from "./reminderWindowActions";
import "./ReminderWindowView.css";

type ReminderWindowViewProps = {
  payload: ReminderWindowShowPayload;
  onDismiss: () => void;
};

export function ReminderWindowView({ payload, onDismiss }: ReminderWindowViewProps) {
  const { primary, additionalCount } = payload;
  const emotion = reminderEmotion(primary);
  const extraLabel = additionalTasksLabel(additionalCount);
  const reminderKind =
    primary.kind === "system" ? primary.reminderKind : "custom";
  const mascotState = mascotStateForReminderKind(reminderKind);
  const mascotAnimation = mascotAnimationForReminderKind(reminderKind);

  return (
    <div className="reminder-window">
      <div
        className="reminder-window__card"
        data-reminder-kind={reminderKind}
        role="dialog"
        aria-labelledby="reminder-window-title"
      >
        <div className="reminder-window__ticket-head">
          <span>WORK ALERT / 工位警报</span>
          <span>#{primary.taskId.slice(-4).toUpperCase()}</span>
        </div>
        <div className="reminder-window__hero">
          <Mascot
            state={mascotState}
            animation={mascotAnimation}
            size="md"
            className="reminder-window__mascot"
          />
        </div>

        <div className="reminder-window__body">
          <p className="reminder-window__eyebrow">{reminderKindLabel(primary)}</p>
          <p className="reminder-window__headline">{reminderHeadline(primary)}</p>
          <h1 id="reminder-window-title" className="reminder-window__task">
            「{primary.taskTitle}」
          </h1>
          <p className="reminder-window__remaining">{reminderRemainingLabel(primary)}</p>
          <p className="reminder-window__emotion">{emotion.label}</p>
          {extraLabel ? (
            <p className="reminder-window__extra" role="status">
              {extraLabel}
            </p>
          ) : null}
        </div>

        <div className="reminder-window__actions">
          <Button
            variant="wheat"
            onClick={() => {
              void openTaskFromReminderWindow(primary.taskId).catch(() => {
                onDismiss();
              });
            }}
          >
            打开任务
          </Button>
          <Button variant="secondary" onClick={onDismiss}>
            知道了
          </Button>
        </div>
        <div className="reminder-window__barcode" aria-hidden="true" />
      </div>
    </div>
  );
}
