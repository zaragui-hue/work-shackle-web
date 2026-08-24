import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  createTask,
  mapTaskError,
  type Task,
  type TaskAppError,
} from "../../services/tauri/tasks";
import { Button, Drawer, Input, Select, Textarea } from "../../shared/ui";
import {
  createDefaultFormValues,
  createTaskFormSchema,
  TASK_PRIORITIES,
  type CreateTaskFormValues,
  toCreateTaskInput,
} from "./createTaskForm";
import "./CreateTaskDrawer.css";

type CreateTaskDrawerProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (task: Task) => void;
};

export function CreateTaskDrawer({ open, onClose, onCreated }: CreateTaskDrawerProps) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateTaskFormValues>({
    resolver: zodResolver(createTaskFormSchema),
    defaultValues: createDefaultFormValues(),
  });

  useEffect(() => {
    if (!open) {
      return;
    }
    reset(createDefaultFormValues());
    setSubmitError(null);
  }, [open, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null);
    try {
      const task = await createTask(toCreateTaskInput(values));
      onCreated?.(task);
      onClose();
    } catch (error) {
      setSubmitError(mapTaskError(error as TaskAppError));
    }
  });

  return (
    <Drawer
      open={open}
      title="新建任务"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            取消
          </Button>
          <Button type="submit" form="create-task-form" disabled={isSubmitting}>
            {isSubmitting ? "保存中…" : "创建任务"}
          </Button>
        </>
      }
    >
      <form id="create-task-form" className="create-task-form" onSubmit={onSubmit}>
        <Input
          label="任务名称"
          placeholder="今天要搬哪块砖"
          autoFocus
          error={errors.title?.message}
          {...register("title")}
        />

        <Textarea
          label="备注"
          placeholder="可选"
          rows={2}
          error={errors.note?.message}
          {...register("note")}
        />

        <section className="create-task-form__time-range" aria-labelledby="create-task-time-range">
          <h3 id="create-task-time-range">任务时间段</h3>
          <Input
            label="开始时间"
            type="datetime-local"
            step={60}
            error={errors.startAt?.message}
            {...register("startAt")}
          />
          <Input
            label="完成时间"
            type="datetime-local"
            step={60}
            error={errors.endAt?.message}
            {...register("endAt")}
          />
        </section>

        <Select
          label="紧急程度"
          error={errors.priority?.message}
          {...register("priority", { valueAsNumber: true })}
        >
          {TASK_PRIORITIES.map((priority) => (
            <option key={priority.value} value={priority.value}>
              {priority.label} · {priority.hint}
            </option>
          ))}
        </Select>

        <Input
          label="对接人"
          placeholder="可选，输入姓名"
          error={errors.contactName?.message}
          {...register("contactName")}
        />

        {submitError ? (
          <p className="create-task-form__error" role="alert">
            {submitError}
          </p>
        ) : null}
      </form>
    </Drawer>
  );
}
