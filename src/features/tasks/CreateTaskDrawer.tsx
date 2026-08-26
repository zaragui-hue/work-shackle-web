import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import {
  createTask,
  mapTaskError,
  type Task,
  type TaskAppError,
} from "../../services/tauri/tasks";
import { Button, Drawer } from "../../shared/ui";
import {
  createDefaultFormValues,
  createTaskFormSchema,
  type CreateTaskFormValues,
  toCreateTaskInput,
} from "./createTaskForm";
import { TaskCoreFields } from "./TaskCoreFields";
import { currentMinuteValue } from "./taskDateTime";
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
    control,
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
        <TaskCoreFields
          register={register}
          control={control}
          errors={errors}
          minStartAt={currentMinuteValue()}
          autoFocusTitle
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
