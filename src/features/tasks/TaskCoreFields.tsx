import type {
  Control,
  FieldErrors,
  FieldValues,
  Path,
  UseFormRegister,
} from "react-hook-form";
import { Controller, useWatch } from "react-hook-form";

import { Input, Select, Textarea } from "../../shared/ui";
import { TASK_PRIORITIES, type CreateTaskFormValues } from "./createTaskForm";
import { TaskDateTimeField } from "./TaskDateTimeField";
import { addMinutesToDateTime } from "./taskDateTime";
import "./TaskCoreFields.css";

type TaskCoreFieldsProps<T extends FieldValues & CreateTaskFormValues> = {
  register: UseFormRegister<T>;
  control: Control<T>;
  errors: FieldErrors<T>;
  disabled?: boolean;
  timeDisabled?: boolean;
  minStartAt?: string;
  autoFocusTitle?: boolean;
  onFieldBlur?: () => void;
  onSelectChange?: () => void;
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
  control,
  errors,
  disabled = false,
  timeDisabled = false,
  minStartAt,
  autoFocusTitle = false,
  onFieldBlur,
  onSelectChange,
}: TaskCoreFieldsProps<T>) {
  const startAt = String(useWatch({ control, name: path<T>("startAt") }) ?? "");
  const timeFieldsDisabled = disabled || timeDisabled;

  return (
    <>
      <Input
        label="任务名称"
        placeholder="今天要搬哪块砖"
        autoFocus={autoFocusTitle}
        disabled={disabled}
        error={errorMessage(errors, "title")}
        {...register(path<T>("title"), { onBlur: onFieldBlur })}
      />

      <Textarea
        label="备注"
        placeholder="可选"
        rows={2}
        disabled={disabled}
        error={errorMessage(errors, "note")}
        {...register(path<T>("note"), { onBlur: onFieldBlur })}
      />

      <section className="task-core-fields__time-range" aria-labelledby="task-core-time-range">
        <h3 id="task-core-time-range">任务时间段</h3>
        {timeDisabled && !disabled ? (
          <p className="task-core-fields__time-lock">任务已开始，完成时间请通过申请延期调整。</p>
        ) : null}
        <Controller
          control={control}
          name={path<T>("startAt")}
          render={({ field }) => (
            <TaskDateTimeField
              label="开始时间"
              value={String(field.value ?? "")}
              min={minStartAt}
              disabled={timeFieldsDisabled}
              error={errorMessage(errors, "startAt")}
              onChange={field.onChange}
              onBlur={() => {
                field.onBlur();
                onFieldBlur?.();
              }}
            />
          )}
        />
        <Controller
          control={control}
          name={path<T>("endAt")}
          render={({ field }) => (
            <TaskDateTimeField
              label="完成时间"
              value={String(field.value ?? "")}
              min={addMinutesToDateTime(startAt, 1)}
              disabled={timeFieldsDisabled}
              error={errorMessage(errors, "endAt")}
              onChange={field.onChange}
              onBlur={() => {
                field.onBlur();
                onFieldBlur?.();
              }}
            />
          )}
        />
      </section>

      <Select
        label="紧急程度"
        disabled={disabled}
        error={errorMessage(errors, "priority")}
        {...register(path<T>("priority"), {
          valueAsNumber: true,
          onChange: onSelectChange,
        })}
      >
        {TASK_PRIORITIES.map((priority) => (
          <option key={priority.value} value={priority.value}>
            {priority.label} · {priority.hint}
          </option>
        ))}
      </Select>

      <Input
        label="🕵️ 接头人"
        placeholder="输入本次行动的秘密联络人"
        disabled={disabled}
        error={errorMessage(errors, "contactName")}
        {...register(path<T>("contactName"), { onBlur: onFieldBlur })}
      />
    </>
  );
}
