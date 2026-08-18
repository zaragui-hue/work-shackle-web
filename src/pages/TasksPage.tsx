import { useCallback, useEffect, useMemo, useState } from "react";

import { TaskCalendar } from "../features/tasks/calendar/TaskCalendar";
import { CreateTaskModal } from "../features/tasks/CreateTaskModal";
import { HistoryBusinessFilter } from "../features/tasks/history/HistoryBusinessFilter";
import { HistoryTimeFilter } from "../features/tasks/history/HistoryTimeFilter";
import {
  createDefaultHistoryFilter,
  hasActiveBusinessFilters,
  toHistoryTasksQuery,
  validateCustomRange,
} from "../features/tasks/history/historyFilterModel";
import { useHistoryTasks } from "../features/tasks/history/useHistoryTasks";
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

type TasksViewMode = "list" | "calendar" | "history";

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
  const [historyFilter, setHistoryFilter] = useState(createDefaultHistoryFilter);

  const customValidationError =
    historyFilter.mode === "custom"
      ? validateCustomRange(historyFilter.customStartDate, historyFilter.customEndDate)
      : null;

  const historyQuery = useMemo(() => {
    if (viewMode !== "history" || customValidationError) {
      return null;
    }
    return toHistoryTasksQuery(historyFilter);
  }, [customValidationError, historyFilter, viewMode]);

  const {
    tasks: historyTasks,
    loading: historyLoading,
    error: historyError,
  } = useHistoryTasks(historyQuery, viewMode === "history" && historyQuery != null);

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
    if (viewMode !== "list") {
      return;
    }
    void loadTasks();
  }, [loadTasks, viewMode]);

  useEffect(() => {
    if (!openTaskRequest) {
      return;
    }
    setSelectedTaskId(openTaskRequest);
    setDrawerOpen(true);
    onOpenTaskHandled?.();
  }, [openTaskRequest, onOpenTaskHandled]);

  const showListEmpty = viewMode === "list" && !loading && !error && tasks.length === 0;
  const showHistoryEmpty =
    viewMode === "history" &&
    !historyLoading &&
    !historyError &&
    !customValidationError &&
    historyTasks.length === 0;
  const historyHasBusinessFilters = hasActiveBusinessFilters(historyFilter);

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
            <Button
              variant={viewMode === "history" ? "primary" : "secondary"}
              className="tasks-page__view-button"
              role="tab"
              aria-selected={viewMode === "history"}
              onClick={() => setViewMode("history")}
            >
              历史
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

        {viewMode === "history" ? (
          <>
            <HistoryTimeFilter filter={historyFilter} onChange={setHistoryFilter} />
            <HistoryBusinessFilter filter={historyFilter} onChange={setHistoryFilter} />
            {customValidationError ? (
              <p className="tasks-page__status" role="alert">
                {customValidationError}
              </p>
            ) : null}
            {!customValidationError && historyLoading ? (
              <p className="tasks-page__status">加载历史任务中…</p>
            ) : null}
            {!customValidationError && historyError ? (
              <div className="tasks-page__status">
                <p role="alert">{historyError}</p>
              </div>
            ) : null}
            {!customValidationError &&
            !historyLoading &&
            !historyError &&
            historyTasks.length > 0 ? (
              <TaskList
                tasks={historyTasks}
                onSelect={(taskId) => {
                  setSelectedTaskId(taskId);
                  setDrawerOpen(true);
                }}
              />
            ) : null}
            {showHistoryEmpty ? (
              <EmptyState
                title={
                  historyHasBusinessFilters
                    ? "当前筛选没有结果"
                    : "这段时间没有记录"
                }
                description={
                  historyHasBusinessFilters
                    ? "试试放宽状态、紧急程度或关键词。"
                    : "换个时间范围看看，或者先把今天的事搞定。"
                }
              />
            ) : null}
          </>
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

        {showListEmpty ? (
          <EmptyState
            title="任务清单空空"
            description="点「新建任务」开始记录第一块砖。"
          />
        ) : null}
      </Card>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          if (viewMode === "list") {
            void loadTasks();
          }
        }}
      />

      <TaskDrawer
        taskId={selectedTaskId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onChanged={() => {
          if (viewMode === "list") {
            void loadTasks();
          }
        }}
      />
    </>
  );
}
