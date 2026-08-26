import { useEffect, useState } from "react";

import type { Task } from "../../services/tauri/tasks";
import { formatContact, formatDeadlineShort } from "../tasks/taskDisplay";
import { ddlProgressFillPercent } from "./ddlProgressDisplay";
import {
  formatOverdueDuration,
  formatPlannedTime,
  formatRemainingUntilDeadline,
} from "./todayDisplay";

type FormalTaskTimingProps = {
  task: Task;
};

export function FormalTaskTiming({ task }: FormalTaskTimingProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const deadlineAtMs = task.deadlineAtMs;
  const hasValidRange =
    deadlineAtMs != null && deadlineAtMs > task.plannedAtMs;
  const progressRatio = hasValidRange
    ? (nowMs - task.plannedAtMs) / (deadlineAtMs - task.plannedAtMs)
    : 0;
  const fillPercent = ddlProgressFillPercent(progressRatio);
  const progressTone =
    progressRatio >= 0.9 ? "danger" : progressRatio >= 0.65 ? "warning" : "calm";
  const remainingText =
    deadlineAtMs == null
      ? null
      : deadlineAtMs <= nowMs
        ? formatOverdueDuration(deadlineAtMs, nowMs)
        : formatRemainingUntilDeadline(deadlineAtMs, nowMs);

  return (
    <div className="today-task-card__formal-timing">
      <div className="today-task-card__formal-meta" data-testid="formal-task-meta">
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

      {hasValidRange ? (
        <div
          className={`today-task-card__formal-progress today-task-card__formal-progress--${progressTone}`}
          role="progressbar"
          aria-label={`${task.title}的时间进度`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fillPercent)}
        >
          <span style={{ width: `${fillPercent}%` }} />
        </div>
      ) : null}
    </div>
  );
}
