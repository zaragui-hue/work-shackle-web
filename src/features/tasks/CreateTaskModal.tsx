import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";

import {
  createTask,
  mapTaskError,
  type Task,
  type TaskAppError,
} from "../../services/tauri/tasks";
import { Button, Input, Modal, Select, Textarea } from "../../shared/ui";
import {
  createDefaultFormValues,
  createTaskFormSchema,
  REMINDER_LIMIT,
  REMINDER_LIMIT_COPY,
  TASK_PRIORITIES,
  type CreateTaskFormValues,
  toCreateTaskInput,
} from "./createTaskForm";
import { ContactPicker } from "./ContactPicker";
import "./CreateTaskModal.css";

type CreateTaskModalProps = {
  open: boolean;
  onClose: () => void;
  onCreated?: (task: Task) => void;
};

export function CreateTaskModal({ open, onClose, onCreated }: CreateTaskModalProps) {
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

  const { fields, append, remove } = useFieldArray({
    control,
    name: "reminders",
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

  const canAddReminder = fields.length < REMINDER_LIMIT;

  return (
    <Modal
      open={open}
      wide
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

        <div className="create-task-form__row">
          <Input
            label="计划时间"
            type="datetime-local"
            error={errors.plannedAt?.message}
            {...register("plannedAt")}
          />
          <Input
            label="DDL"
            type="datetime-local"
            hint="可选，精确到分钟"
            error={errors.deadlineAt?.message}
            {...register("deadlineAt")}
          />
        </div>

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

        <Controller
          control={control}
          name="contactId"
          render={({ field }) => (
            <ContactPicker
              active={open}
              value={field.value}
              onChange={field.onChange}
              error={errors.contactId?.message}
              disabled={isSubmitting}
            />
          )}
        />

        <section className="create-task-form__reminders" aria-labelledby="create-task-reminders">
          <div className="create-task-form__reminders-header">
            <div>
              <h3 id="create-task-reminders">自定义提醒</h3>
              <p>{REMINDER_LIMIT_COPY}</p>
            </div>
            <Button
              type="button"
              variant="secondary"
              disabled={!canAddReminder || isSubmitting}
              onClick={() => append({ remindAt: "", message: "" })}
            >
              添加提醒
            </Button>
          </div>

          {errors.reminders?.message ? (
            <p className="create-task-form__error" role="alert">
              {errors.reminders.message}
            </p>
          ) : null}

          {fields.length === 0 ? (
            <p className="create-task-form__empty">还没有自定义提醒。</p>
          ) : (
            <ul className="create-task-form__reminder-list">
              {fields.map((field, index) => (
                <li key={field.id} className="create-task-form__reminder-item">
                  <Input
                    label={`提醒 ${index + 1} 时间`}
                    type="datetime-local"
                    error={errors.reminders?.[index]?.remindAt?.message}
                    {...register(`reminders.${index}.remindAt`)}
                  />
                  <Input
                    label="提醒说明"
                    placeholder="可选"
                    error={errors.reminders?.[index]?.message?.message}
                    {...register(`reminders.${index}.message`)}
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => remove(index)}
                    disabled={isSubmitting}
                  >
                    移除
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {submitError ? (
          <p className="create-task-form__error" role="alert">
            {submitError}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
