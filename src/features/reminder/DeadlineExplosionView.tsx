import { useMemo, useState } from "react";

import {
  mascotAnimationForReminderKind,
  mascotStateForReminderKind,
} from "../../assets/mascot";
import type { ReminderWindowShowPayload } from "../../services/tauri/reminder";
import { mapTaskError, type TaskAppError } from "../../services/tauri/tasks";
import { Button, Mascot } from "../../shared/ui";
import {
  defaultExplosionPostponeClock,
  nextDeadlineFromClock,
} from "./deadlineExplosionTime";
import {
  beginTaskFromReminderWindow,
  completeTaskFromReminderWindow,
  postponeTaskFromReminderWindow,
} from "./reminderWindowActions";
import "./DeadlineExplosionView.css";

type DeadlineExplosionViewProps = {
  payload: ReminderWindowShowPayload;
};

function formatDeadlineTime(deadlineAtMs: number): string {
  return new Date(deadlineAtMs).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export function DeadlineExplosionView({ payload }: DeadlineExplosionViewProps) {
  const { primary, additionalCount } = payload;
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [clock, setClock] = useState(() => defaultExplosionPostponeClock());
  const [busyAction, setBusyAction] = useState<"begin" | "postpone" | "complete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const originalTime = useMemo(
    () =>
      primary.kind === "system"
        ? formatDeadlineTime(primary.deadlineSnapshotMs)
        : "--:--",
    [primary],
  );
  const mascotState = mascotStateForReminderKind("ddl_due");
  const mascotAnimation = mascotAnimationForReminderKind("ddl_due");

  const runAction = async (
    action: "begin" | "postpone" | "complete",
    task: () => Promise<void>,
  ) => {
    setBusyAction(action);
    setError(null);
    try {
      await task();
    } catch (caught) {
      setError(mapTaskError(caught as TaskAppError));
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <main className="deadline-explosion">
      <section
        className="deadline-explosion__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="deadline-explosion-title"
        aria-describedby="deadline-explosion-copy"
      >
        <header className="deadline-explosion__ticket-head">
          <span>DEADLINE INCIDENT / 工位事故</span>
          <span>#{primary.taskId.slice(-4).toUpperCase()}</span>
        </header>

        <div className="deadline-explosion__hero">
          <div className="deadline-explosion__boom" aria-label="到点爆炸">
            <span>到点</span>
            <span>爆炸</span>
          </div>
          <Mascot
            state={mascotState}
            animation={mascotAnimation}
            size="md"
            className="deadline-explosion__mascot"
          />
        </div>

        <div className="deadline-explosion__body">
          <p className="deadline-explosion__eyebrow">DDL 已归零 · 现在不是演习</p>
          <h1 id="deadline-explosion-title">{primary.taskTitle}</h1>
          <p id="deadline-explosion-copy" className="deadline-explosion__copy">
            这活正式炸了。现在处理还能叫抢救，再拖就只能叫考古。
          </p>
          <div className="deadline-explosion__time">
            <span>原定完成时间</span>
            <strong>{originalTime}</strong>
          </div>
          {additionalCount > 0 ? (
            <p className="deadline-explosion__extra" role="status">
              还有 {additionalCount} 个任务也炸了
            </p>
          ) : null}
        </div>

        <div className="deadline-explosion__actions">
          <Button
            className="deadline-explosion__begin"
            disabled={busyAction !== null}
            onClick={() =>
              void runAction("begin", () =>
                beginTaskFromReminderWindow(primary.taskId),
              )
            }
          >
            {busyAction === "begin" ? "正在抢救…" : "现在处理"}
          </Button>
          <Button
            className="deadline-explosion__delay"
            variant="wheat"
            disabled={busyAction !== null}
            aria-expanded={postponeOpen}
            onClick={() => {
              setError(null);
              setPostponeOpen((current) => !current);
            }}
          >
            延期
          </Button>
          <Button
            className="deadline-explosion__complete"
            variant="secondary"
            disabled={busyAction !== null}
            onClick={() =>
              void runAction("complete", () =>
                completeTaskFromReminderWindow(primary.taskId),
              )
            }
          >
            {busyAction === "complete" ? "正在收尸…" : "结束任务"}
          </Button>
        </div>

        {postponeOpen ? (
          <div className="deadline-explosion__postpone">
            <label htmlFor="deadline-explosion-time">新的截止时间</label>
            <div>
              <input
                id="deadline-explosion-time"
                type="time"
                value={clock}
                onChange={(event) => setClock(event.target.value)}
              />
              <Button
                disabled={busyAction !== null || !clock}
                onClick={() =>
                  void runAction("postpone", () =>
                    postponeTaskFromReminderWindow(
                      primary.taskId,
                      nextDeadlineFromClock(clock),
                    ),
                  )
                }
              >
                {busyAction === "postpone" ? "延期中…" : "确认延期"}
              </Button>
            </div>
            <p>所选时间已过则顺延到明天。同一新 DDL 到点后会重新提醒。</p>
          </div>
        ) : null}

        {error ? (
          <p className="deadline-explosion__error" role="alert">
            {error}，弹窗先留着，请再试一次。
          </p>
        ) : null}
      </section>
    </main>
  );
}
