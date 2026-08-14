import { useCallback, useEffect, useState } from "react";

import { CreateTaskModal } from "../features/tasks/CreateTaskModal";
import { TaskDrawer } from "../features/tasks/TaskDrawer";
import { LunchReminderBanner } from "../features/today/LunchReminderBanner";
import { TodayTaskBoard } from "../features/today/TodayTaskBoard";
import { useLunchReminder } from "../features/today/useLunchReminder";
import { WorkStatusPanel } from "../features/today/WorkStatusPanel";
import { isTodayFullyEmpty } from "../features/today/todayDisplay";
import { useWorkCountdown } from "../features/today/useWorkCountdown";
import { WorkCountdownBanner } from "../features/today/WorkCountdownBanner";
import {
  mapTaskError,
  queryTodayTasks,
  type TaskAppError,
  type TodayTasks,
} from "../services/tauri/tasks";
import { switchWorkStatus } from "../services/tauri/workStatus";
import { Button, Card, EmptyState } from "../shared/ui";
import "./TodayPage.css";

const EMPTY_TODAY: TodayTasks = {
  formalTasks: [],
  upcomingDeadlineTasks: [],
  overdueTasks: [],
  completedTodayTasks: [],
};

export function TodayPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [todayTasks, setTodayTasks] = useState<TodayTasks>(EMPTY_TODAY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    display: workCountdown,
    loading: workCountdownLoading,
    error: workCountdownError,
  } = useWorkCountdown();
  const {
    reminder: lunchReminder,
    loading: lunchReminderLoading,
    dismissed: lunchReminderDismissed,
    dismiss: dismissLunchReminder,
  } = useLunchReminder();
  const [switchingToLunch, setSwitchingToLunch] = useState(false);

  const loadTodayTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await queryTodayTasks();
      setTodayTasks(next);
    } catch (caught) {
      setError(mapTaskError(caught as TaskAppError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTodayTasks();
  }, [loadTodayTasks]);

  const showEmpty =
    !loading && !error && isTodayFullyEmpty(todayTasks);

  const onSwitchToLunch = async () => {
    setSwitchingToLunch(true);
    try {
      await switchWorkStatus("lunch");
      dismissLunchReminder();
    } finally {
      setSwitchingToLunch(false);
    }
  };

  return (
    <>
      <Card title="今日" headerAccent>
        {workCountdownLoading ? (
          <div
            className="today-page__countdown-skeleton"
            aria-busy="true"
            aria-label="加载工作时间"
          />
        ) : null}

        {!workCountdownLoading && workCountdownError ? (
          <div className="today-page__countdown-status">
            <p role="alert">{workCountdownError}</p>
          </div>
        ) : null}

        {!workCountdownLoading && !workCountdownError && workCountdown ? (
          <WorkCountdownBanner display={workCountdown} />
        ) : null}

        {!lunchReminderLoading && lunchReminder && !lunchReminderDismissed ? (
          <LunchReminderBanner
            reminder={lunchReminder}
            onDismiss={dismissLunchReminder}
            onSwitchToLunch={() => void onSwitchToLunch()}
            switchingToLunch={switchingToLunch}
          />
        ) : null}

        <WorkStatusPanel />

        <div className="today-page__toolbar">
          <Button onClick={() => setCreateOpen(true)}>+ 新任务</Button>
        </div>

        {loading ? (
          <div className="today-page__skeleton" aria-busy="true" aria-label="加载今日任务">
            <div className="today-page__skeleton-block" />
            <div className="today-page__skeleton-block today-page__skeleton-block--short" />
            <div className="today-page__skeleton-block" />
          </div>
        ) : null}

        {error ? (
          <div className="today-page__status">
            <p role="alert">{error}</p>
            <Button variant="secondary" onClick={() => void loadTodayTasks()}>
              重试
            </Button>
          </div>
        ) : null}

        {!loading && !error && !showEmpty ? (
          <TodayTaskBoard
            tasks={todayTasks}
            onSelect={(taskId) => {
              setSelectedTaskId(taskId);
              setDrawerOpen(true);
            }}
          />
        ) : null}

        {showEmpty ? (
          <EmptyState
            title="今天居然没什么事"
            description="班味暂未加载。先喝口水，有事了再记一笔。"
            action={
              <Button onClick={() => setCreateOpen(true)}>+ 新任务</Button>
            }
          />
        ) : null}
      </Card>

      <CreateTaskModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void loadTodayTasks()}
      />

      <TaskDrawer
        taskId={selectedTaskId}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onChanged={() => void loadTodayTasks()}
      />
    </>
  );
}
