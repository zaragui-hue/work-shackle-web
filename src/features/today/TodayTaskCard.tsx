import { useEffect, useState } from "react";

import type { Task } from "../../services/tauri/tasks";
import {
  formatContact,
  formatDeadlineShort,
  priorityLabel,
  priorityToneClass,
  statusLabel,
} from "../tasks/taskDisplay";
import {
  formatCompletedTime,
  formatOverdueDuration,
  formatPlannedTime,
  formatRemainingUntilDeadline,
  isDeadlineOverdueToday,
} from "./todayDisplay";
import { DdlTimeProgress } from "./DdlTimeProgress";
import {
  overdueChaosLabel,
  overdueChaosLevel,
  taskStatusStampCopy,
  taskUrgencyTone,
} from "./ddlProgressDisplay";
import { TaskAutoStartBroadcast } from "./TaskAutoStartBroadcast";
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
              <div className="today-task-card__status-stack">
                <span
                  className={`today-task-card__status-stamp today-task-card__status-stamp--${task.status} today-task-card__status-stamp--urgency-${taskUrgencyTone(task.priority)}${announceAutoStart ? " today-task-card__status-stamp--announced" : ""}`}
                  aria-label={`任务状态：${statusLabel(task.status)}，紧急程度：${priorityLabel(task.priority)}`}
                >
                  {taskStatusStampCopy(task.status)}
                </span>
                {announceAutoStart ? (
                  <span className="today-task-card__status-source">
                    {formatPlannedTime(task.plannedAtMs)} · 自动
                  </span>
                ) : null}
              </div>
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
            <div className="today-task-card__formal-meta" data-testid="formal-task-meta">
              {task.deadlineAtMs != null ? (
                <DdlTimeProgress
                  plannedAtMs={task.plannedAtMs}
                  deadlineAtMs={task.deadlineAtMs}
                  presentation="remaining-only"
                />
              ) : null}
              <span className="today-task-card__formal-meta-item">
                计划 {formatPlannedTime(task.plannedAtMs)}
              </span>
              {task.deadlineAtMs != null ? (
                <span className="today-task-card__formal-meta-item">
                  DDL {formatDeadlineShort(task.deadlineAtMs)}
                </span>
              ) : null}
              {task.contactSnapshot?.trim() ? (
                <span className="today-task-card__contact">
                  {formatContact(task)}
                </span>
              ) : null}
            </div>
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
