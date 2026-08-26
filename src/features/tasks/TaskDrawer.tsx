import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";

import {
  cancelTask,
  completeTask,
  getTaskDetail,
  mapTaskError,
  updateTask,
  type Task,
  type TaskAppError,
  type TaskDetail,
} from "../../services/tauri/tasks";
import { Button, Drawer, Select } from "../../shared/ui";
import {
  formatPostponementRange,
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

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function TaskDrawer({ taskId, open, onClose, onChanged }: TaskDrawerProps) {
  const [detail, setDetail] = useState<TaskDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [postponeOpen, setPostponeOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const mountedRef = useRef(true);
  const activeTaskIdRef = useRef<string | null>(null);
  const latestTaskRef = useRef<Task | null>(null);
  const lastSavedKeyRef = useRef("");
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const saveByKeyRef = useRef(new Map<string, Promise<boolean>>());

  const {
    register,
    getValues,
    reset,
    trigger,
    watch,
    formState: { errors },
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

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setLoading(true);
    setActionError(null);
    try {
      const next = await getTaskDetail(id);
      const values = taskDetailToFormValues(next);
      setDetail(next);
      activeTaskIdRef.current = next.task.id;
      latestTaskRef.current = next.task;
      lastSavedKeyRef.current = `${next.task.id}:${JSON.stringify(values)}`;
      setSaveStatus("idle");
      reset(values);
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
      activeTaskIdRef.current = null;
      latestTaskRef.current = null;
      setActionError(null);
      setPostponeOpen(false);
      setSaveStatus("idle");
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

  const enqueueSave = useCallback((values: TaskDrawerFormValues) => {
    const task = latestTaskRef.current;
    if (!task) {
      return Promise.resolve(false);
    }

    const key = `${task.id}:${JSON.stringify(values)}`;
    if (key === lastSavedKeyRef.current) {
      return Promise.resolve(true);
    }

    const existing = saveByKeyRef.current.get(key);
    if (existing) {
      return existing;
    }

    const run = saveChainRef.current.then(async () => {
      const latestTask = latestTaskRef.current?.id === task.id
        ? latestTaskRef.current
        : task;
      if (mountedRef.current && activeTaskIdRef.current === task.id) {
        setActionError(null);
        setSaveStatus("saving");
      }

      try {
        const updated = await updateTask(toUpdateTaskInput(latestTask, values));
        if (mountedRef.current && activeTaskIdRef.current === task.id) {
          latestTaskRef.current = updated;
          lastSavedKeyRef.current = key;
          setDetail((current) => current && current.task.id === task.id
            ? { ...current, task: updated }
            : current);
          setSaveStatus("saved");
          onChanged();
        }
        return true;
      } catch (caught) {
        if (mountedRef.current && activeTaskIdRef.current === task.id) {
          setSaveStatus("error");
          setActionError(mapTaskError(caught as TaskAppError));
        }
        return false;
      }
    });

    saveChainRef.current = run.then(() => undefined);
    saveByKeyRef.current.set(key, run);
    void run.then(() => {
      if (saveByKeyRef.current.get(key) === run) {
        saveByKeyRef.current.delete(key);
      }
    });
    return run;
  }, [onChanged]);

  const requestAutoSave = useCallback(async () => {
    if (!detail || terminal) {
      return terminal;
    }
    const valid = await trigger();
    if (!valid) {
      return false;
    }
    return enqueueSave(getValues());
  }, [detail, enqueueSave, getValues, terminal, trigger]);

  const handleSelectAutoSave = useCallback(() => {
    queueMicrotask(() => {
      void requestAutoSave();
    });
  }, [requestAutoSave]);

  const handleComplete = async () => {
    if (!detail) {
      return;
    }
    if (!await requestAutoSave()) {
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
    if (!await requestAutoSave()) {
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

  const handleOpenPostpone = async () => {
    if (!await requestAutoSave()) {
      return;
    }
    setPostponeOpen(true);
  };

  const actionBusy = saveStatus === "saving";

  return (
    <>
      <Drawer
        open={open}
        title="任务详情"
        onClose={onClose}
        footer={
          detail && !terminal ? (
            <>
              <Button variant="secondary" onClick={() => void handleCancelTask()} disabled={actionBusy}>
                取消任务
              </Button>
              {canPostpone ? (
                <Button
                  variant="wheat"
                  className="task-drawer__postpone-btn"
                  onClick={() => void handleOpenPostpone()}
                  disabled={actionBusy}
                >
                  申请延期
                </Button>
              ) : null}
              <Button onClick={() => void handleComplete()} disabled={actionBusy}>
                完成任务
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
          <form
            id="task-drawer-form"
            className="task-drawer__form"
            onSubmit={(event) => event.preventDefault()}
          >
            <TaskCoreFields
              register={register}
              errors={errors}
              disabled={terminal}
              onFieldBlur={() => void requestAutoSave()}
              onSelectChange={handleSelectAutoSave}
            />

            {saveStatus === "saving" ? (
              <p className="task-drawer__save-status" role="status">正在传递情报…</p>
            ) : null}
            {saveStatus === "saved" ? (
              <p className="task-drawer__save-status" role="status">情报已同步</p>
            ) : null}

            <section className="task-drawer__management" aria-labelledby="task-drawer-management">
              <div className="task-drawer__management-heading">
                <h3 id="task-drawer-management">任务管理</h3>
              </div>

              {!terminal && hasValidTimeRange ? (
                <DdlTimeProgress
                  plannedAtMs={displayedPlannedAtMs}
                  deadlineAtMs={displayedDeadlineAtMs}
                />
              ) : null}

              <Select
                label="主状态"
                disabled={terminal}
                error={errors.status?.message}
                {...register("status", { onChange: handleSelectAutoSave })}
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
