import { useEffect, useState } from "react";

import type { Task } from "../../services/tauri/tasks";
import {
  formatContact,
  formatDeadlineShort,
  priorityLabel,
  priorityToneClass,
} from "../tasks/taskDisplay";
import {
  formatCompletedTime,
  formatOverdueDuration,
  formatRemainingUntilDeadline,
  isDeadlineOverdueToday,
} from "./todayDisplay";
import { DdlTimeProgress } from "./DdlTimeProgress";
import { FormalTaskTiming } from "./FormalTaskTiming";
import {
  overdueChaosLabel,
  overdueChaosLevel,
} from "./ddlProgressDisplay";
import { TaskAutoStartBroadcast } from "./TaskAutoStartBroadcast";
import { TaskPressureStamp } from "./TaskPressureStamp";
import { useTaskPressure } from "./useTaskPressure";
import "../tasks/priorityTone.css";
import "./TodayTaskCard.css";

export type TodayTaskCardVariant =
  | "upcoming"
  | "formal"
  | "overdue"
  | "completed";

type TodayTaskCardProps = {
  task: Task;
  variant: TodayTaskCardVariant;
  onSelect?: (taskId: string) => void;
  announceAutoStart?: boolean;
  onBroadcastDismissed?: (taskId: string) => void;
};

function OverdueChaosStamp({ deadlineAtMs }: { deadlineAtMs: number }) {
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(intervalId);
  }, []);

  const level = overdueChaosLevel(deadlineAtMs, nowMs);
  const label = overdueChaosLabel(level);

  return (
    <span
      className={`today-task-card__chaos-stamp today-task-card__chaos-stamp--${level}`}
      aria-label={`逾期状态：${label}`}
    >
      {label}
    </span>
  );
}

export function TodayTaskCard({
  task,
  variant,
  onSelect,
  announceAutoStart = false,
  onBroadcastDismissed,
}: TodayTaskCardProps) {
  const overdueToday =
    variant === "formal" && isDeadlineOverdueToday(task.deadlineAtMs);
  const pressure = useTaskPressure(
    task.plannedAtMs,
    variant === "formal" ? task.deadlineAtMs : undefined,
  );

  return (
    <li
      className={`today-task-card today-task-card--${variant}${overdueToday ? " today-task-card--formal-overdue" : ""}`}
    >
      <button
        type="button"
        className="today-task-card__button"
        onClick={() => onSelect?.(task.id)}
      >
        <span
          className={`today-task-card__priority ${priorityToneClass(task.priority)}`}
          aria-hidden="true"
        />
        <div className="today-task-card__body">
          <div className="today-task-card__head">
            <h3 className="today-task-card__title">{task.title}</h3>
            {variant === "formal" ? (
              <TaskPressureStamp
                task={task}
                pressure={pressure}
                autoStarted={announceAutoStart}
              />
            ) : null}
            {variant === "overdue" && task.deadlineAtMs != null ? (
              <OverdueChaosStamp deadlineAtMs={task.deadlineAtMs} />
            ) : null}
            {variant === "upcoming" && task.deadlineAtMs != null ? (
              <p className="today-task-card__deadline">
                <span className="today-task-card__deadline-label">DDL</span>
                <span className="today-task-card__deadline-value">
                  {formatDeadlineShort(task.deadlineAtMs)}
                </span>
              </p>
            ) : null}
          </div>

          {variant === "upcoming" && task.deadlineAtMs != null ? (
            <p className="today-task-card__remaining">
              {formatRemainingUntilDeadline(task.deadlineAtMs)}
            </p>
          ) : null}

          {variant === "overdue" && task.deadlineAtMs != null ? (
            <div className="today-task-card__overdue-meta">
              <span className="today-task-card__meta-chip">
                DDL {formatDeadlineShort(task.deadlineAtMs)}
              </span>
              <span className="today-task-card__overdue-badge">
                {formatOverdueDuration(task.deadlineAtMs)}
              </span>
            </div>
          ) : null}

          {variant === "formal" ? (
            <FormalTaskTiming task={task} pressure={pressure} />
          ) : null}

          {variant === "upcoming" || variant === "overdue" ? (
            <DdlTimeProgress
              plannedAtMs={task.plannedAtMs}
              deadlineAtMs={task.deadlineAtMs}
              showRemaining={false}
            />
          ) : null}

          {variant !== "formal" ? <div className="today-task-card__foot">
            {variant === "completed" ? (
              <>
                {task.completedAtMs != null ? (
                  <span className="today-task-card__meta-chip today-task-card__meta-chip--muted">
                    {formatCompletedTime(task.completedAtMs)}
                  </span>
                ) : null}
                <span className="today-task-card__meta-chip today-task-card__meta-chip--muted">
                  {priorityLabel(task.priority)}
                </span>
              </>
            ) : null}

            {variant === "upcoming" ? (
              <span className="today-task-card__meta-chip">
                {priorityLabel(task.priority)}
              </span>
            ) : null}

            {variant === "overdue" ? (
              <>
                <span className="today-task-card__meta-chip">
                  {priorityLabel(task.priority)}
                </span>
                {task.contactSnapshot?.trim() ? (
                  <span className="today-task-card__contact">
                    {formatContact(task)}
                  </span>
                ) : null}
              </>
            ) : null}
          </div> : null}
        </div>
      </button>
      {variant === "formal" && announceAutoStart ? (
        <TaskAutoStartBroadcast
          plannedAtMs={task.plannedAtMs}
          onDismiss={() => onBroadcastDismissed?.(task.id)}
        />
      ) : null}
    </li>
  );
}
