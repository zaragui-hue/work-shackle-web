import { useState, type ReactNode } from "react";

import type { Task, TaskStatus, TodayTasks } from "../../services/tauri/tasks";
import { TodayTaskCard } from "./TodayTaskCard";
import "./TodayTaskBoard.css";

type TodayTaskBoardProps = {
  tasks: TodayTasks;
  onSelect?: (taskId: string) => void;
  announcedTaskIds?: string[];
  onBroadcastDismissed?: (taskId: string) => void;
  onStatusChange?: (task: Task, status: TaskStatus) => void | Promise<void>;
  statusBusyTaskId?: string | null;
};

type SectionProps = {
  title: string;
  hint?: string;
  tone?: "default" | "upcoming" | "debt";
  children: ReactNode;
};

function TodaySection({ title, hint, tone = "default", children }: SectionProps) {
  return (
    <section
      className={`today-board__section today-board__section--${tone}`}
      aria-labelledby={`today-section-${title}`}
    >
      <header className="today-board__section-head">
        <h3 className="today-board__section-title" id={`today-section-${title}`}>
          {title}
        </h3>
        {hint ? <p className="today-board__section-hint">{hint}</p> : null}
      </header>
      {children}
    </section>
  );
}

function TodayTaskList({
  tasks,
  variant,
  onSelect,
  listKey,
  announcedTaskIds,
  onBroadcastDismissed,
  onStatusChange,
  statusBusyTaskId,
}: {
  tasks: Task[];
  variant: "upcoming" | "formal" | "overdue" | "completed";
  onSelect?: (taskId: string) => void;
  listKey: string;
  announcedTaskIds: Set<string>;
  onBroadcastDismissed?: (taskId: string) => void;
  onStatusChange?: (task: Task, status: TaskStatus) => void | Promise<void>;
  statusBusyTaskId?: string | null;
}) {
  return (
    <ul className="today-board__list" aria-label={listKey}>
      {tasks.map((task) => (
        <TodayTaskCard
          key={`${listKey}-${task.id}`}
          task={task}
          variant={variant}
          onSelect={onSelect}
          announceAutoStart={variant === "formal" && announcedTaskIds.has(task.id)}
          onBroadcastDismissed={onBroadcastDismissed}
          onStatusChange={onStatusChange}
          statusBusy={statusBusyTaskId === task.id}
        />
      ))}
    </ul>
  );
}

function TodayCompletedSection({
  tasks,
  onSelect,
}: {
  tasks: TodayTasks["completedTodayTasks"];
  onSelect?: (taskId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (tasks.length === 0) {
    return null;
  }

  return (
    <section className="today-board__section today-board__section--completed">
      <button
        type="button"
        className="today-board__completed-toggle"
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="today-board__completed-label">
          ✓ 今天已经搞定 {tasks.length} 件事
        </span>
        <span className="today-board__completed-chevron" aria-hidden="true">
          {expanded ? "▾" : "▸"}
        </span>
      </button>
      {expanded ? (
        <TodayTaskList
          tasks={tasks}
          variant="completed"
          onSelect={onSelect}
          listKey="completed"
          announcedTaskIds={new Set()}
        />
      ) : null}
    </section>
  );
}

export function TodayTaskBoard({
  tasks,
  onSelect,
  announcedTaskIds = [],
  onBroadcastDismissed,
  onStatusChange,
  statusBusyTaskId,
}: TodayTaskBoardProps) {
  const { formalTasks, overdueTasks, completedTodayTasks } = tasks;
  const announcedTaskIdSet = new Set(announcedTaskIds);

  return (
    <div className="today-board">
      {formalTasks.length > 0 ? (
        <section
          className="today-board__section today-board__section--default"
          aria-label="今日正式任务"
        >
          <TodayTaskList
            tasks={formalTasks}
            variant="formal"
            onSelect={onSelect}
            listKey="formal"
            announcedTaskIds={announcedTaskIdSet}
            onBroadcastDismissed={onBroadcastDismissed}
            onStatusChange={onStatusChange}
            statusBusyTaskId={statusBusyTaskId}
          />
        </section>
      ) : null}

      {overdueTasks.length > 0 ? (
        <TodaySection title="历史欠账" tone="debt" hint="以前遗留下来的">
          <TodayTaskList
            tasks={overdueTasks}
            variant="overdue"
            onSelect={onSelect}
            listKey="overdue"
            announcedTaskIds={announcedTaskIdSet}
            onBroadcastDismissed={onBroadcastDismissed}
            onStatusChange={onStatusChange}
            statusBusyTaskId={statusBusyTaskId}
          />
        </TodaySection>
      ) : null}

      <TodayCompletedSection tasks={completedTodayTasks} onSelect={onSelect} />
    </div>
  );
}
