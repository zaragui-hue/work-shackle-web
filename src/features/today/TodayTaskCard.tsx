import { useEffect, useState } from "react";

import type { Task, TaskStatus } from "../../services/tauri/tasks";
import {
  formatContact,
  formatDeadlineShort,
  isTerminalStatus,
  priorityToneClass,
  statusLabel,
} from "../tasks/taskDisplay";
import { TASK_STATUS_OPTIONS } from "../tasks/taskStatusActions";
import {
  formatCompletedTime,
  formatRemainingUntilDeadline,
  isDeadlineOverdueToday,
  overdueTreatmentPrompt,
} from "./todayDisplay";
import { DdlTimeProgress } from "./DdlTimeProgress";
import { FormalTaskTiming } from "./FormalTaskTiming";
import { TaskAutoStartBroadcast } from "./TaskAutoStartBroadcast";
import { TaskPriorityMenu } from "./TaskPriorityMenu";
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
  onStatusChange?: (task: Task, status: TaskStatus) => void | Promise<void>;
  statusBusy?: boolean;
  onPriorityChange?: (task: Task, priority: number) => void | Promise<void>;
  priorityBusy?: boolean;
};

export function TodayTaskCard({
  task,
  variant,
  onSelect,
  announceAutoStart = false,
  onBroadcastDismissed,
  onStatusChange,
  statusBusy = false,
  onPriorityChange,
  priorityBusy = false,
}: TodayTaskCardProps) {
  const overdueToday =
    variant === "formal" && isDeadlineOverdueToday(task.deadlineAtMs);
  const pressure = useTaskPressure(
    task.plannedAtMs,
    variant === "formal" ? task.deadlineAtMs : undefined,
  );
  const terminal = isTerminalStatus(task.status);
  const statusOptions =
    task.status === "not_started"
      ? TASK_STATUS_OPTIONS
      : TASK_STATUS_OPTIONS.filter((option) => option.value !== "not_started");
  const note = task.note?.trim();
  const [displayPriority, setDisplayPriority] = useState(task.priority);

  useEffect(() => {
    setDisplayPriority(task.priority);
  }, [task.priority]);

  const openDetail = () => onSelect?.(task.id);

  const changePriority = async (priority: number) => {
    if (priority === displayPriority || !onPriorityChange) {
      return;
    }

    const previousPriority = displayPriority;
    setDisplayPriority(priority);
    try {
      await onPriorityChange(task, priority);
    } catch {
      setDisplayPriority(previousPriority);
    }
  };

  return (
    <li
      className={`today-task-card today-task-card--${variant}${overdueToday ? " today-task-card--formal-overdue" : ""}`}
    >
      <span
        className={`today-task-card__priority ${priorityToneClass(displayPriority)}`}
        aria-hidden="true"
      />

      <div className="today-task-card__content">
        <div className="today-task-card__topline">
          <button
            type="button"
            className="today-task-card__title-button"
            onClick={openDetail}
          >
            <h3 className="today-task-card__title">{task.title}</h3>
          </button>

          <div className="today-task-card__actions">
            <TaskPriorityMenu
              taskTitle={task.title}
              value={displayPriority}
              disabled={terminal || priorityBusy || !onPriorityChange}
              onChange={(priority) => void changePriority(priority)}
            />

            {terminal ? (
              <span
                className="today-task-card__terminal-status"
                aria-label={`${task.title} 主状态`}
              >
                {statusLabel(task.status)}
              </span>
            ) : (
              <label className="today-task-card__status-control">
                <span className="today-task-card__sr-only">主状态</span>
                <select
                  aria-label={`${task.title} 主状态`}
                  value={task.status}
                  disabled={statusBusy}
                  onChange={(event) => {
                    void onStatusChange?.(task, event.target.value as TaskStatus);
                  }}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>

        {note ? (
          <button
            type="button"
            className="today-task-card__note"
            onClick={openDetail}
            title={note}
          >
            {note}
          </button>
        ) : null}

        <button
          type="button"
          className="today-task-card__detail-meta"
          onClick={openDetail}
          aria-label={`查看${task.title}详情`}
        >
          {variant === "upcoming" ? (
            <div className="today-task-card__compact-meta">
              {task.deadlineAtMs != null ? (
                <>
                  <span>{formatRemainingUntilDeadline(task.deadlineAtMs)}</span>
                  <span>DDL {formatDeadlineShort(task.deadlineAtMs)}</span>
                </>
              ) : null}
              {task.contactSnapshot?.trim() ? (
                <span>{formatContact(task)}</span>
              ) : null}
            </div>
          ) : null}

          {variant === "overdue" ? (
            <>
              <div className="today-task-card__compact-meta">
                {task.deadlineAtMs != null ? (
                  <>
                    <span>原 DDL {formatDeadlineShort(task.deadlineAtMs)}</span>
                  </>
                ) : null}
                {task.contactSnapshot?.trim() ? (
                  <span>{formatContact(task)}</span>
                ) : null}
              </div>
              {task.deadlineAtMs != null ? (
                <p className="today-task-card__overdue-prompt">
                  {overdueTreatmentPrompt(task.deadlineAtMs)}
                </p>
              ) : null}
            </>
          ) : null}

          {variant === "formal" ? (
            <FormalTaskTiming task={task} pressure={pressure} />
          ) : null}

          {variant === "completed" ? (
            <div className="today-task-card__compact-meta">
              {task.completedAtMs != null ? (
                <span>{formatCompletedTime(task.completedAtMs)}</span>
              ) : null}
              {task.contactSnapshot?.trim() ? (
                <span>{formatContact(task)}</span>
              ) : null}
            </div>
          ) : null}

          {variant === "upcoming" ? (
            <DdlTimeProgress
              plannedAtMs={task.plannedAtMs}
              deadlineAtMs={task.deadlineAtMs}
              showRemaining={false}
              showMeta={false}
            />
          ) : null}

          {variant === "overdue" ? (
            <DdlTimeProgress
              plannedAtMs={task.plannedAtMs}
              deadlineAtMs={task.deadlineAtMs}
              presentation="track-marker"
              forceFull
            />
          ) : null}
        </button>
      </div>

      {variant === "formal" && announceAutoStart ? (
        <div className="today-task-card__broadcast">
          <TaskAutoStartBroadcast
            plannedAtMs={task.plannedAtMs}
            onDismiss={() => onBroadcastDismissed?.(task.id)}
          />
        </div>
      ) : null}
    </li>
  );
}
