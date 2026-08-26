import { useId } from "react";

import { splitDateTime, combineDateTime } from "./taskDateTime";
import "./TaskDateTimeField.css";

type TaskDateTimeFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  error?: string;
  hint?: string;
  min?: string;
};

export function TaskDateTimeField({
  label,
  value,
  onChange,
  onBlur,
  disabled = false,
  error,
  hint,
  min,
}: TaskDateTimeFieldProps) {
  const fieldId = useId();
  const current = splitDateTime(value);
  const minimum = splitDateTime(min ?? "");
  const timeMinimum = current.date === minimum.date ? minimum.time : undefined;

  return (
    <fieldset className="task-datetime-field" disabled={disabled}>
      <legend className="ws-field__label">{label}</legend>
      <div
        className="task-datetime-field__controls"
        aria-invalid={error ? true : undefined}
      >
        <label className="task-datetime-field__part" htmlFor={`${fieldId}-date`}>
          <span>日期</span>
          <input
            id={`${fieldId}-date`}
            className="ws-input"
            type="date"
            disabled={disabled}
            aria-label={`${label} 日期`}
            value={current.date}
            min={minimum.date || undefined}
            onChange={(event) => onChange(combineDateTime(event.target.value, current.time))}
            onBlur={onBlur}
          />
        </label>
        <label className="task-datetime-field__part" htmlFor={`${fieldId}-time`}>
          <span>时分</span>
          <input
            id={`${fieldId}-time`}
            className="ws-input"
            type="time"
            disabled={disabled}
            step={60}
            aria-label={`${label} 时分`}
            value={current.time}
            min={timeMinimum || undefined}
            onChange={(event) => onChange(combineDateTime(current.date, event.target.value))}
            onBlur={onBlur}
          />
        </label>
      </div>
      {hint ? <p className="ws-field__hint">{hint}</p> : null}
      {error ? (
        <p className="ws-field__error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
