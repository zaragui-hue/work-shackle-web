import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

import {
  mapTaskError,
  postponeTask,
  type TaskAppError,
} from "../../services/tauri/tasks";
import { Button, Modal, Textarea } from "../../shared/ui";
import { datetimeLocalToMs } from "./createTaskForm";
import { formatDeadline, msToDatetimeLocal } from "./taskDisplay";
import { TaskDateTimeField } from "./TaskDateTimeField";
import { addMinutesToDateTime } from "./taskDateTime";
import "./PostponeTaskModal.css";

const postponeTaskFormSchema = z
  .object({
    newDeadlineAt: z.string().min(1, "请填写新完成时间"),
    reason: z.string().trim().min(1, "请填写延期原因"),
  })
  .superRefine((values, context) => {
    const newDeadlineAtMs = datetimeLocalToMs(values.newDeadlineAt);
    if (Number.isNaN(newDeadlineAtMs)) {
      context.addIssue({
        code: "custom",
        message: "新完成时间格式无效",
        path: ["newDeadlineAt"],
      });
    }
  });

type PostponeTaskFormValues = z.infer<typeof postponeTaskFormSchema>;

type PostponeTaskModalProps = {
  open: boolean;
  taskId: string | null;
  currentDeadlineAtMs?: number;
  plannedAtMs?: number;
  onClose: () => void;
  onPostponed: () => void;
};

export function PostponeTaskModal({
  open,
  taskId,
  currentDeadlineAtMs,
  plannedAtMs,
  onClose,
  onPostponed,
}: PostponeTaskModalProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    control,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PostponeTaskFormValues>({
    resolver: zodResolver(postponeTaskFormSchema),
    defaultValues: {
      newDeadlineAt: "",
      reason: "",
    },
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    reset({
      newDeadlineAt: currentDeadlineAtMs
        ? msToDatetimeLocal(currentDeadlineAtMs + 60 * 60 * 1000)
        : "",
      reason: "",
    });
    setSubmitError(null);
  }, [open, currentDeadlineAtMs, reset]);

  const onSubmit = handleSubmit(async (values) => {
    if (!taskId) {
      return;
    }

    const newDeadlineAtMs = datetimeLocalToMs(values.newDeadlineAt);
    if (currentDeadlineAtMs != null && newDeadlineAtMs <= currentDeadlineAtMs) {
      setSubmitError("新完成时间必须晚于当前完成时间");
      return;
    }
    if (plannedAtMs != null && newDeadlineAtMs < plannedAtMs) {
      setSubmitError("新完成时间不能早于计划时间");
      return;
    }

    setSubmitError(null);
    try {
      await postponeTask({
        taskId,
        newDeadlineAtMs,
        reason: values.reason.trim(),
      });
      onPostponed();
      onClose();
    } catch (error) {
      setSubmitError(mapTaskError(error as TaskAppError));
    }
  });

  return (
    <Modal
      open={open}
      title="延期任务"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
          <Button type="submit" form="postpone-task-form" disabled={isSubmitting}>
            {isSubmitting ? "提交中…" : "确认延期"}
          </Button>
        </>
      }
    >
      {currentDeadlineAtMs != null ? (
        <p className="postpone-task-modal__current">
          当前完成时间：{formatDeadline(currentDeadlineAtMs)}
        </p>
      ) : null}

      {submitError ? (
        <p className="postpone-task-modal__error" role="alert">
          {submitError}
        </p>
      ) : null}

      <form id="postpone-task-form" className="postpone-task-modal__form" onSubmit={onSubmit}>
        <Controller
          control={control}
          name="newDeadlineAt"
          render={({ field }) => (
            <TaskDateTimeField
              label="新完成时间"
              value={field.value}
              min={currentDeadlineAtMs == null
                ? undefined
                : addMinutesToDateTime(msToDatetimeLocal(currentDeadlineAtMs), 1)}
              hint="必须晚于当前完成时间"
              error={errors.newDeadlineAt?.message}
              onChange={field.onChange}
              onBlur={field.onBlur}
            />
          )}
        />

        <Textarea
          label="延期原因"
          rows={3}
          placeholder="例如：研发接口没给"
          error={errors.reason?.message}
          {...register("reason")}
        />
      </form>
    </Modal>
  );
}
