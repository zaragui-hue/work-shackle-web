import type { Task } from "../../services/tauri/tasks";
import { formatContact, formatDeadlineShort } from "../tasks/taskDisplay";
import type { TaskPressure } from "./taskPressure";
import { ddlEmotionLabel } from "./ddlProgressDisplay";
import {
  formatOverdueDuration,
  formatPlannedTime,
  formatRemainingUntilDeadline,
} from "./todayDisplay";

type FormalTaskTimingProps = {
  task: Task;
  pressure: TaskPressure;
};

export function FormalTaskTiming({ task, pressure }: FormalTaskTimingProps) {
  const deadlineAtMs = task.deadlineAtMs;
  const remainingText =
    deadlineAtMs == null
      ? null
      : deadlineAtMs <= pressure.nowMs
        ? formatOverdueDuration(deadlineAtMs, pressure.nowMs)
        : formatRemainingUntilDeadline(deadlineAtMs, pressure.nowMs);

  return (
    <div className="today-task-card__formal-timing">
      <div className="today-task-card__formal-meta" data-testid="formal-task-meta">
        {pressure.valid ? (
          <span
            className={`today-task-card__pressure-copy today-task-card__pressure-copy--${pressure.emotion}`}
          >
            时间 {pressure.percentLabel} · {ddlEmotionLabel(pressure.emotion)}
          </span>
        ) : null}
        {remainingText ? (
          <span
            className="ddl-time-progress__remaining-inline"
            data-testid="ddl-remaining-inline"
          >
            {remainingText}
          </span>
        ) : null}
        <span className="today-task-card__formal-meta-item">
          计划 {formatPlannedTime(task.plannedAtMs)}
        </span>
        {deadlineAtMs != null ? (
          <span className="today-task-card__formal-meta-item">
            DDL {formatDeadlineShort(deadlineAtMs)}
          </span>
        ) : null}
        {task.contactSnapshot?.trim() ? (
          <span className="today-task-card__contact">{formatContact(task)}</span>
        ) : null}
      </div>

      {pressure.valid ? (
        <div
          className={`today-task-card__formal-progress today-task-card__formal-progress--${pressure.emotion}`}
          role="progressbar"
          aria-label={`${task.title}的时间进度`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pressure.fillPercent)}
        >
          <span style={{ width: `${pressure.fillPercent}%` }} />
        </div>
      ) : null}
    </div>
  );
}
