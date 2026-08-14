import { useCallback, useEffect, useState } from "react";

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

export function TasksPage() {
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

  const showEmpty = !loading && !error && tasks.length === 0;

  return (
    <>
      <Card title="任务" headerAccent>
        <div className="tasks-page__toolbar" style={{ marginBottom: "var(--space-3)" }}>
          <Button onClick={() => setCreateOpen(true)}>新建任务</Button>
        </div>

        {loading ? (
          <p className="tasks-page__status">加载任务中…</p>
        ) : null}

        {error ? (
          <div className="tasks-page__status">
            <p role="alert">{error}</p>
            <Button variant="secondary" onClick={() => void loadTasks()}>
              重试
            </Button>
          </div>
        ) : null}

        {!loading && !error && tasks.length > 0 ? (
          <TaskList
            tasks={tasks}
            onSelect={(taskId) => {
              setSelectedTaskId(taskId);
              setDrawerOpen(true);
            }}
          />
        ) : null}

        {showEmpty ? (
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
