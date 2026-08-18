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
};

export function TodayTaskCard({ task, variant, onSelect }: TodayTaskCardProps) {
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

          {overdueToday && task.deadlineAtMs != null ? (
            <p className="today-task-card__overdue-badge">
              {formatOverdueDuration(task.deadlineAtMs)}
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

          {variant !== "completed" ? (
            <DdlTimeProgress
              plannedAtMs={task.plannedAtMs}
              deadlineAtMs={task.deadlineAtMs}
              showRemaining={variant === "formal" && !overdueToday}
            />
          ) : null}

          <div className="today-task-card__foot">
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

            {variant === "formal" ? (
              <>
                <span className="today-task-card__meta-chip">
                  {priorityLabel(task.priority)}
                </span>
                <span className="today-task-card__meta-chip today-task-card__meta-chip--status">
                  {statusLabel(task.status)}
                </span>
                <span className="today-task-card__meta-chip">
                  计划 {formatPlannedTime(task.plannedAtMs)}
                </span>
                {task.deadlineAtMs != null ? (
                  <span className="today-task-card__meta-chip">
                    DDL {formatDeadlineShort(task.deadlineAtMs)}
                  </span>
                ) : null}
                {task.contactSnapshot?.trim() ? (
                  <span className="today-task-card__contact">
                    {formatContact(task)}
                  </span>
                ) : null}
              </>
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
          </div>
        </div>
      </button>
    </li>
  );
}
