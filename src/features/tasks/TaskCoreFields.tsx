import type {
  FieldErrors,
  FieldValues,
  Path,
  UseFormRegister,
} from "react-hook-form";

import { Input, Select, Textarea } from "../../shared/ui";
import { TASK_PRIORITIES, type CreateTaskFormValues } from "./createTaskForm";
import "./TaskCoreFields.css";

type TaskCoreFieldsProps<T extends FieldValues & CreateTaskFormValues> = {
  register: UseFormRegister<T>;
  errors: FieldErrors<T>;
  disabled?: boolean;
  autoFocusTitle?: boolean;
};

const path = <T extends FieldValues>(name: keyof CreateTaskFormValues) => name as Path<T>;

function errorMessage<T extends FieldValues>(
  errors: FieldErrors<T>,
  name: keyof CreateTaskFormValues,
) {
  const error = (errors as Record<string, { message?: unknown } | undefined>)[name];
  return typeof error?.message === "string" ? error.message : undefined;
}

export function TaskCoreFields<T extends FieldValues & CreateTaskFormValues>({
  register,
  errors,
  disabled = false,
  autoFocusTitle = false,
}: TaskCoreFieldsProps<T>) {
  return (
    <>
      <Input
        label="任务名称"
        placeholder="今天要搬哪块砖"
        autoFocus={autoFocusTitle}
        disabled={disabled}
        error={errorMessage(errors, "title")}
        {...register(path<T>("title"))}
      />

      <Textarea
        label="备注"
        placeholder="可选"
        rows={2}
        disabled={disabled}
        error={errorMessage(errors, "note")}
        {...register(path<T>("note"))}
      />

      <section className="task-core-fields__time-range" aria-labelledby="task-core-time-range">
        <h3 id="task-core-time-range">任务时间段</h3>
        <Input
          label="开始时间"
          type="datetime-local"
          step={60}
          disabled={disabled}
          error={errorMessage(errors, "startAt")}
          {...register(path<T>("startAt"))}
        />
        <Input
          label="完成时间"
          type="datetime-local"
          step={60}
          disabled={disabled}
          error={errorMessage(errors, "endAt")}
          {...register(path<T>("endAt"))}
        />
      </section>

      <Select
        label="紧急程度"
        disabled={disabled}
        error={errorMessage(errors, "priority")}
        {...register(path<T>("priority"), { valueAsNumber: true })}
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
        disabled={disabled}
        error={errorMessage(errors, "contactName")}
        {...register(path<T>("contactName"))}
      />
    </>
  );
}
