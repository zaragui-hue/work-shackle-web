import { useCallback, useEffect, useState } from "react";

import { copy } from "../config/copy";
import { CreateTaskDrawer } from "../features/tasks/CreateTaskDrawer";
import { TaskDrawer } from "../features/tasks/TaskDrawer";
import { LunchReminderBanner } from "../features/today/LunchReminderBanner";
import { TodayTaskBoard } from "../features/today/TodayTaskBoard";
import { useLunchReminder } from "../features/today/useLunchReminder";
import { OvertimeBanner } from "../features/today/OvertimeBanner";
import { useOvertime } from "../features/today/useOvertime";
import {
  WorkEndDecisionBanner,
  WorkOffCompleteBanner,
} from "../features/today/WorkEndDecisionBanner";
import { isWorkDayFinished } from "../features/today/workEndDisplay";
import { useWorkEndDecision } from "../features/today/useWorkEndDecision";
import { StatusCockpit } from "../features/today/StatusCockpit";
import { useWorkStatus } from "../features/today/WorkStatusContext";
import { WorkdayStatusNotice } from "../features/today/WorkdayStatusNotice";
import { isTodayFullyEmpty } from "../features/today/todayDisplay";
import { useWorkCountdown } from "../features/today/useWorkCountdown";
import { WorkCountdownBanner } from "../features/today/WorkCountdownBanner";
import { WorkScheduleEditor } from "../features/today/WorkScheduleEditor";
import { useWorkdayReminders } from "../features/today/useWorkdayReminders";
import { useWorkdayStatusAutomation } from "../features/today/useWorkdayStatusAutomation";
import {
  mapTaskError,
  queryTodayTasks,
  type TaskAppError,
  type TodayTasks,
} from "../services/tauri/tasks";
import { Button, Card, EmptyState } from "../shared/ui";
import "./TodayPage.css";

const EMPTY_TODAY: TodayTasks = {
  formalTasks: [],
  upcomingDeadlineTasks: [],
  overdueTasks: [],
  completedTodayTasks: [],
  autoStartedTaskIds: [],
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
    schedule: workSchedule,
    loading: workCountdownLoading,
    error: workCountdownError,
    applySchedule,
  } = useWorkCountdown();
  const {
    state: workEndState,
    loading: workEndLoading,
    confirming: confirmingNormalOff,
    error: workEndError,
    confirmNormalOff,
    refresh: refreshWorkEnd,
  } = useWorkEndDecision();
  const {
    active: activeOvertime,
    display: overtimeDisplay,
    loading: overtimeLoading,
    starting: startingOvertime,
    ending: endingOvertime,
    error: overtimeError,
    start: startOvertime,
    end: endOvertime,
    refresh: refreshOvertime,
  } = useOvertime();
  const {
    reminder: lunchReminder,
    loading: lunchReminderLoading,
    dismissed: lunchReminderDismissed,
    dismiss: dismissLunchReminder,
  } = useLunchReminder();
  const [switchingToLunch, setSwitchingToLunch] = useState(false);
  const reminderManager = useWorkdayReminders(workSchedule?.workDate);
  const statusAutomation = useWorkdayStatusAutomation(reminderManager);
  const { switchStatus } = useWorkStatus();

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

  useEffect(() => {
    if (workCountdown?.phase === "after_end") {
      void refreshWorkEnd();
    }
  }, [workCountdown?.phase, refreshWorkEnd]);

  const showOvertimeBanner =
    !overtimeLoading &&
    !workEndLoading &&
    workEndState?.phase === "overtime_active" &&
    activeOvertime !== null &&
    overtimeDisplay !== null;
  const showWorkEndDecision =
    !workEndLoading && workEndState?.phase === "pending_decision";
  const workDayFinished = isWorkDayFinished(workEndState?.phase);
  const showWorkOffComplete =
    !workEndLoading && workDayFinished && Boolean(workEndState?.displayCopy);
  const showWorkCountdownBanner =
    !workCountdownLoading &&
    !workCountdownError &&
    workCountdown &&
    !showWorkEndDecision &&
    !workDayFinished &&
    workEndState?.phase !== "overtime_active";

  const showEmpty =
    !loading && !error && isTodayFullyEmpty(todayTasks);

  const onStartOvertime = async () => {
    await startOvertime();
    await refreshWorkEnd();
  };

  const onEndOvertime = async () => {
    await endOvertime();
    await refreshWorkEnd();
    await refreshOvertime();
  };

  const onSwitchToLunch = async () => {
    setSwitchingToLunch(true);
    try {
      await switchStatus("lunch");
      dismissLunchReminder();
    } finally {
      setSwitchingToLunch(false);
    }
  };

  return (
    <>
      {statusAutomation.notice ? (
        <WorkdayStatusNotice
          notice={statusAutomation.notice}
          switching={statusAutomation.switching}
          onRetry={statusAutomation.retry}
          onDismiss={statusAutomation.dismiss}
        />
      ) : null}

      <div className="today-page__dashboard">
        <section className="today-page__stage" aria-label="今日下班进度">
          <StatusCockpit schedule={workSchedule}>
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

            {!workCountdownLoading && !workCountdownError && showWorkCountdownBanner ? (
              <WorkCountdownBanner
                display={workCountdown!}
                schedule={workSchedule}
              />
            ) : null}

            {workEndError ? (
              <div className="today-page__countdown-status">
                <p role="alert">{workEndError}</p>
              </div>
            ) : null}

            {showWorkEndDecision ? (
              <WorkEndDecisionBanner
                onConfirmNormalOff={() => void confirmNormalOff()}
                onStartOvertime={() => void onStartOvertime()}
                confirmingNormalOff={confirmingNormalOff}
                startingOvertime={startingOvertime}
              />
            ) : null}

            {showOvertimeBanner ? (
              <OvertimeBanner
                elapsedText={overtimeDisplay!.elapsedText}
                onEnd={() => void onEndOvertime()}
                ending={endingOvertime}
              />
            ) : null}

            {overtimeError ? (
              <div className="today-page__countdown-status">
                <p role="alert">{overtimeError}</p>
              </div>
            ) : null}

            {showWorkOffComplete && workEndState?.displayCopy ? (
              <WorkOffCompleteBanner message={workEndState.displayCopy} />
            ) : null}
          </StatusCockpit>
        </section>

        <Card title="今日待办 / 不建议补货" headerAccent className="today-page__tasks-card">
          {!lunchReminderLoading && lunchReminder && !lunchReminderDismissed ? (
            <LunchReminderBanner
              reminder={lunchReminder}
              onDismiss={dismissLunchReminder}
              onSwitchToLunch={() => void onSwitchToLunch()}
              switchingToLunch={switchingToLunch}
            />
          ) : null}

          <div className="today-page__toolbar">
            <p>活可以插，队不能乱。</p>
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
              title={copy.today.emptyTitle}
              description={copy.today.emptyDescription}
              action={<Button onClick={() => setCreateOpen(true)}>+ 新任务</Button>}
            />
          ) : null}

        </Card>

        {workSchedule ? (
          <WorkScheduleEditor
            schedule={workSchedule}
            reminderManager={reminderManager}
            onSaved={(next) => {
              applySchedule(next);
              void refreshWorkEnd();
              void refreshOvertime();
            }}
          />
        ) : null}
      </div>

      <CreateTaskDrawer
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
