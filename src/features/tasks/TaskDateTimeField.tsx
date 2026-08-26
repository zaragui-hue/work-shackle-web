import { useId } from "react";

import { splitDateTime, combineDateTime } from "./taskDateTime";
import "./TaskDateTimeField.css";

const HOURS = Array.from({ length: 24 }, (_, hour) => String(hour).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, minute) => String(minute).padStart(2, "0"));

function splitTime(time: string): { hour: string; minute: string } {
  const [hour = "", minute = ""] = time.split(":");
  return { hour, minute };
}

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
  const currentTime = splitTime(current.time);
  const minimum = splitDateTime(min ?? "");
  const minimumTime = splitTime(minimum.time);
  const hasTimeMinimum = current.date === minimum.date && Boolean(minimum.time);

  const normalizeTime = (date: string, time: string) => {
    if (date === minimum.date && minimum.time && time < minimum.time) {
      return minimum.time;
    }
    return time;
  };

  const updateDate = (date: string) => {
    onChange(combineDateTime(date, normalizeTime(date, current.time)));
  };

  const updateTime = (hour: string, minute: string) => {
    const time = hour && minute ? `${hour}:${minute}` : "";
    onChange(combineDateTime(current.date, normalizeTime(current.date, time)));
  };

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
            onChange={(event) => updateDate(event.target.value)}
            onBlur={onBlur}
          />
        </label>
        <div className="task-datetime-field__time-part">
          <span className="task-datetime-field__part-label">时间</span>
          <div className="task-datetime-field__time-selectors">
            <label htmlFor={`${fieldId}-hour`}>
              <span>小时</span>
              <select
                id={`${fieldId}-hour`}
                className="ws-input"
                disabled={disabled}
                aria-label={`${label} 小时`}
                value={currentTime.hour}
                onChange={(event) => updateTime(event.target.value, currentTime.minute)}
                onBlur={onBlur}
              >
                <option value="" disabled>--</option>
                {HOURS.map((hour) => (
                  <option
                    key={hour}
                    value={hour}
                    disabled={hasTimeMinimum && hour < minimumTime.hour}
                  >
                    {hour}
                  </option>
                ))}
              </select>
            </label>
            <span className="task-datetime-field__separator" aria-hidden="true">:</span>
            <label htmlFor={`${fieldId}-minute`}>
              <span>分钟</span>
              <select
                id={`${fieldId}-minute`}
                className="ws-input"
                disabled={disabled}
                aria-label={`${label} 分钟`}
                value={currentTime.minute}
                onChange={(event) => updateTime(currentTime.hour, event.target.value)}
                onBlur={onBlur}
              >
                <option value="" disabled>--</option>
                {MINUTES.map((minute) => (
                  <option
                    key={minute}
                    value={minute}
                    disabled={
                      hasTimeMinimum
                      && currentTime.hour === minimumTime.hour
                      && minute < minimumTime.minute
                    }
                  >
                    {minute}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
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
