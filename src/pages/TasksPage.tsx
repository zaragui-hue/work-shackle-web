import { useCallback, useEffect, useState } from "react";

import { TaskCalendar } from "../features/tasks/calendar/TaskCalendar";
import { CreateTaskModal } from "../features/tasks/CreateTaskModal";
import { TaskDrawer } from "../features/tasks/TaskDrawer";
import { TaskList } from "../features/tasks/TaskList";
import {
  mapTaskError,
  queryTasks,
  type Task,
  type TaskAppError,
} from "../services/tauri/tasks";
import { Button, Card, EmptyState } from "../shared/ui";
import "./TasksPage.css";

type TasksViewMode = "list" | "calendar";

type TasksPageProps = {
  openTaskRequest?: string | null;
  onOpenTaskHandled?: () => void;
};

export function TasksPage({
  openTaskRequest = null,
  onOpenTaskHandled,
}: TasksPageProps) {
  const [viewMode, setViewMode] = useState<TasksViewMode>("list");
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await queryTasks();
      setTasks(next);
    } catch (caught) {
      setError(mapTaskError(caught as TaskAppError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  useEffect(() => {
    if (!openTaskRequest) {
      return;
    }
    setSelectedTaskId(openTaskRequest);
    setDrawerOpen(true);
    onOpenTaskHandled?.();
  }, [openTaskRequest, onOpenTaskHandled]);

  const showEmpty = !loading && !error && tasks.length === 0;

  return (
    <>
      <Card title="任务" headerAccent>
        <div className="tasks-page__toolbar">
          <div className="tasks-page__view-toggle" role="tablist" aria-label="任务视图">
            <Button
              variant={viewMode === "list" ? "primary" : "secondary"}
              className="tasks-page__view-button"
              role="tab"
              aria-selected={viewMode === "list"}
              onClick={() => setViewMode("list")}
            >
              列表
            </Button>
            <Button
              variant={viewMode === "calendar" ? "primary" : "secondary"}
              className="tasks-page__view-button"
              role="tab"
              aria-selected={viewMode === "calendar"}
              onClick={() => setViewMode("calendar")}
            >
              日历
            </Button>
          </div>
          <Button onClick={() => setCreateOpen(true)}>新建任务</Button>
        </div>

        {viewMode === "calendar" ? (
          <TaskCalendar
            onSelectTask={(taskId) => {
              setSelectedTaskId(taskId);
              setDrawerOpen(true);
            }}
          />
        ) : null}

        {viewMode === "list" && loading ? (
          <p className="tasks-page__status">加载任务中…</p>
        ) : null}

        {viewMode === "list" && error ? (
          <div className="tasks-page__status">
            <p role="alert">{error}</p>
            <Button variant="secondary" onClick={() => void loadTasks()}>
              重试
            </Button>
          </div>
        ) : null}

        {viewMode === "list" && !loading && !error && tasks.length > 0 ? (
          <TaskList
            tasks={tasks}
            onSelect={(taskId) => {
              setSelectedTaskId(taskId);
              setDrawerOpen(true);
            }}
          />
        ) : null}

        {viewMode === "list" && showEmpty ? (
          <EmptyState
            title="任务清单空空"
            description="点「新建任务」开始记录第一块砖。"
          />
        ) : null}
      </Card>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void loadTasks()}
      />

      <TaskDrawer
        taskId={selectedTaskId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onChanged={() => void loadTasks()}
      />
    </>
  );
}
