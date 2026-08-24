import { useState, type ReactNode } from "react";

import type { TodayTasks } from "../../services/tauri/tasks";
import { TodayTaskCard } from "./TodayTaskCard";
import "./TodayTaskBoard.css";

type TodayTaskBoardProps = {
  tasks: TodayTasks;
  onSelect?: (taskId: string) => void;
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
}: {
  tasks: TodayTasks[keyof TodayTasks];
  variant: "upcoming" | "formal" | "overdue" | "completed";
  onSelect?: (taskId: string) => void;
  listKey: string;
}) {
  return (
    <ul className="today-board__list" aria-label={listKey}>
      {tasks.map((task) => (
        <TodayTaskCard
          key={`${listKey}-${task.id}`}
          task={task}
          variant={variant}
          onSelect={onSelect}
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
        />
      ) : null}
    </section>
  );
}

export function TodayTaskBoard({ tasks, onSelect }: TodayTaskBoardProps) {
  const { formalTasks, overdueTasks, completedTodayTasks } = tasks;

  return (
    <div className="today-board">
      {formalTasks.length > 0 ? (
        <TodaySection title="今天要干" hint="今天正式安排">
          <TodayTaskList
            tasks={formalTasks}
            variant="formal"
            onSelect={onSelect}
            listKey="formal"
          />
        </TodaySection>
      ) : null}

      {overdueTasks.length > 0 ? (
        <TodaySection title="历史欠账" tone="debt" hint="以前遗留下来的">
          <TodayTaskList
            tasks={overdueTasks}
            variant="overdue"
            onSelect={onSelect}
            listKey="overdue"
          />
        </TodaySection>
      ) : null}

      <TodayCompletedSection tasks={completedTodayTasks} onSelect={onSelect} />
    </div>
  );
}
