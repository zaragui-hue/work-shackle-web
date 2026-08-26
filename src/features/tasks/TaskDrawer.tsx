import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  cancelTask,
  completeTask,
  getTaskDetail,
  mapTaskError,
  updateTask,
  type TaskAppError,
  type TaskDetail,
} from "../../services/tauri/tasks";
import { Button, Drawer, Select } from "../../shared/ui";
import {
  formatPostponementRange,
  formatReminderTime,
  isTerminalStatus,
  postponementCountLabel,
} from "./taskDisplay";
import { DdlTimeProgress } from "../today/DdlTimeProgress";
import { datetimeLocalToMs } from "./createTaskForm";
import { PostponeTaskModal } from "./PostponeTaskModal";
import { TaskCoreFields } from "./TaskCoreFields";
import {
  TASK_STATUS_OPTIONS,
  taskDetailToFormValues,
  taskDrawerFormSchema,
  toUpdateTaskInput,
  type TaskDrawerFormValues,
} from "./taskDrawerForm";
import "./TaskDrawer.css";

type TaskDrawerProps = {
  taskId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
};

export function TaskDrawer({ taskId, open, onClose, onChanged }: TaskDrawerProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [postponeOpen, setPostponeOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<TaskDrawerFormValues>({
    resolver: zodResolver(taskDrawerFormSchema),
    defaultValues: {
      title: "",
      note: "",
      startAt: "",
      endAt: "",
      priority: 2,
      contactName: "",
      status: "not_started",
    },
  });

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setActionError(null);
    try {
      const next = await getTaskDetail(id);
      setDetail(next);
      reset(taskDetailToFormValues(next));
    } catch (caught) {
      setActionError(mapTaskError(caught as TaskAppError));
      setDetail(null);
    } finally {
      setLoading(false);
    }
  }, [reset]);

  useEffect(() => {
    if (!open || !taskId) {
      setDetail(null);
      setActionError(null);
      setPostponeOpen(false);
      return;
    }
    void loadDetail(taskId);
  }, [open, taskId, loadDetail]);

  const terminal = detail ? isTerminalStatus(detail.task.status) : false;
  const canPostpone = detail != null && !terminal && detail.task.deadlineAtMs != null;
  const startAt = watch("startAt");
  const endAt = watch("endAt");
  const displayedPlannedAtMs = startAt ? datetimeLocalToMs(startAt) : Number.NaN;
  const displayedDeadlineAtMs = endAt ? datetimeLocalToMs(endAt) : Number.NaN;
  const hasValidTimeRange =
    Number.isFinite(displayedPlannedAtMs) &&
    Number.isFinite(displayedDeadlineAtMs) &&
    displayedDeadlineAtMs > displayedPlannedAtMs;

  const onSubmit = handleSubmit(async (values) => {
    if (!detail) {
      return;
    }
    setActionError(null);
    try {
      await updateTask(toUpdateTaskInput(detail.task, values));
      onChanged();
      await loadDetail(detail.task.id);
    } catch (caught) {
      setActionError(mapTaskError(caught as TaskAppError));
    }
  });

  const handleComplete = async () => {
    if (!detail) {
      return;
    }
    setActionError(null);
    try {
      await completeTask(detail.task.id);
      onChanged();
      onClose();
    } catch (caught) {
      setActionError(mapTaskError(caught as TaskAppError));
    }
  };

  const handleCancelTask = async () => {
    if (!detail) {
      return;
    }
    if (!window.confirm("确定取消这个任务吗？取消后仍保留在历史记录中。")) {
      return;
    }
    setActionError(null);
    try {
      await cancelTask(detail.task.id);
      onChanged();
      onClose();
    } catch (caught) {
      setActionError(mapTaskError(caught as TaskAppError));
    }
  };

  const handlePostponed = async () => {
    if (!detail) {
      return;
    }
    onChanged();
    await loadDetail(detail.task.id);
  };

  return (
    <>
      <Drawer
        open={open}
        title="任务详情"
        onClose={onClose}
        footer={
          detail && !terminal ? (
            <>
              <Button variant="secondary" onClick={() => void handleCancelTask()} disabled={isSubmitting}>
                取消任务
              </Button>
              <Button variant="wheat" onClick={() => void handleComplete()} disabled={isSubmitting}>
                完成
              </Button>
              <Button type="submit" form="task-drawer-form" disabled={isSubmitting}>
                {isSubmitting ? "保存中…" : "保存"}
              </Button>
            </>
          ) : null
        }
      >
        {loading ? <p className="task-drawer__status">加载中…</p> : null}

        {actionError ? (
          <p className="task-drawer__error" role="alert">
            {actionError}
          </p>
        ) : null}

        {detail && !loading ? (
          <form id="task-drawer-form" className="task-drawer__form" onSubmit={onSubmit}>
            <TaskCoreFields
              register={register}
              errors={errors}
              disabled={terminal || isSubmitting}
            />

            <section className="task-drawer__management" aria-labelledby="task-drawer-management">
              <div className="task-drawer__management-heading">
                <h3 id="task-drawer-management">任务管理</h3>
                {canPostpone ? (
                  <Button
                    type="button"
                    variant="wheat"
                    className="task-drawer__postpone-btn"
                    onClick={() => setPostponeOpen(true)}
                    disabled={isSubmitting}
                  >
                    延期
                  </Button>
                ) : null}
              </div>

              {!terminal && hasValidTimeRange ? (
                <DdlTimeProgress
                  plannedAtMs={displayedPlannedAtMs}
                  deadlineAtMs={displayedDeadlineAtMs}
                />
              ) : null}

              <Select
                label="主状态"
                disabled={terminal || isSubmitting}
                error={errors.status?.message}
                {...register("status")}
              >
                {TASK_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </section>

            {detail.postponements.length > 0 ? (
              <section className="task-drawer__section" aria-labelledby="task-drawer-postponements">
                <h3 id="task-drawer-postponements">{postponementCountLabel(detail.postponements.length)}</h3>
                <ol className="task-drawer__postponement-list">
                  {detail.postponements.map((postponement, index) => (
                    <li key={postponement.id}>
                      <strong>第 {index + 1} 次</strong>
                      <span>
                        {formatPostponementRange(
                          postponement.oldDeadlineAtMs,
                          postponement.newDeadlineAtMs,
                        )}
                      </span>
                      <span>{postponement.reason}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ) : null}

            <section className="task-drawer__section" aria-labelledby="task-drawer-reminders">
              <h3 id="task-drawer-reminders">自定义提醒</h3>
              {detail.reminders.length === 0 ? (
                <p className="task-drawer__empty">还没有自定义提醒。</p>
              ) : (
                <ul className="task-drawer__reminder-list">
                  {detail.reminders.map((reminder) => (
                    <li key={reminder.id}>
                      <strong>{formatReminderTime(reminder.remindAtMs)}</strong>
                      {reminder.message ? <span>{reminder.message}</span> : null}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {terminal ? (
              <p className="task-drawer__terminal-note">此任务已结束，详情为只读。</p>
            ) : null}
          </form>
        ) : null}
      </Drawer>

      <PostponeTaskModal
        open={postponeOpen}
        taskId={detail?.task.id ?? null}
        currentDeadlineAtMs={detail?.task.deadlineAtMs}
        plannedAtMs={detail?.task.plannedAtMs}
        onClose={() => setPostponeOpen(false)}
        onPostponed={() => void handlePostponed()}
      />
    </>
  );
}
