import { useEffect, useState } from "react";

import { workTimeFormSchema } from "../settings/workTimeForm";
import {
  mapSettingsError,
  saveDefaultWorkTimes,
  saveTodayWorkOverride,
  type SettingsAppError,
  type WorkSchedule,
} from "../../services/tauri/settings";
import { Button } from "../../shared/ui";
import type { WorkdayReminderManager } from "./useWorkdayReminders";
import {
  REMINDER_STATUS_OPTIONS,
  reminderStatusLabel,
} from "./workdayReminders";
import "./WorkScheduleEditor.css";

const HOURS = Array.from({ length: 24 }, (_, value) =>
  String(value).padStart(2, "0"),
);
const MINUTES = Array.from({ length: 60 }, (_, value) =>
  String(value).padStart(2, "0"),
);

function splitClock(value: string) {
  const [hour = "", minute = ""] = value.split(":");
  return { hour, minute };
}

type WorkScheduleEditorProps = {
  schedule: WorkSchedule;
  onSaved: (next: WorkSchedule) => void;
  reminderManager?: WorkdayReminderManager;
};

export function WorkScheduleEditor({
  schedule,
  onSaved,
  reminderManager,
}: WorkScheduleEditorProps) {
  const [endTime, setEndTime] = useState(schedule.effectiveEnd);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedEndTime = splitClock(endTime);

  useEffect(() => {
    setEndTime(schedule.effectiveEnd);
    setError(null);
  }, [schedule.effectiveEnd]);

  const persist = async (nextEnd: string) => {
    setEndTime(nextEnd);
    const parsed = workTimeFormSchema.safeParse({
      startTime: schedule.effectiveStart,
      endTime: nextEnd,
    });
    if (!parsed.success) {
      setEndTime(schedule.effectiveEnd);
      setError(parsed.error.issues[0]?.message ?? "时间设置无效");
      return;
    }
    if (nextEnd === schedule.effectiveEnd || saving) {
      setError(null);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = {
        startTime: schedule.effectiveStart,
        endTime: nextEnd,
      };
      const next = schedule.hasTodayOverride
        ? await saveTodayWorkOverride(payload)
        : await saveDefaultWorkTimes(payload);
      onSaved(next);
    } catch (caught) {
      setEndTime(schedule.effectiveEnd);
      setError(mapSettingsError(caught as SettingsAppError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="work-schedule-editor">
      <p className="work-schedule-editor__kicker">
        WORKDAY TOOLS / <span>{schedule.hasTodayOverride ? "今日临时" : "默认排班"}</span>
      </p>
      <h2 className="work-schedule-editor__title">工位控制台</h2>
      <div
        className="work-schedule-editor__time-controls"
        role="group"
        aria-label="下班时间"
      >
        <select
          aria-label="下班小时"
          value={selectedEndTime.hour}
          disabled={saving}
          onChange={(event) => {
            void persist(`${event.target.value}:${selectedEndTime.minute}`);
          }}
        >
          {HOURS.map((hour) => (
            <option value={hour} key={hour}>{hour}</option>
          ))}
        </select>
        <span aria-hidden="true">:</span>
        <select
          aria-label="下班分钟"
          value={selectedEndTime.minute}
          disabled={saving}
          onChange={(event) => {
            void persist(`${selectedEndTime.hour}:${event.target.value}`);
          }}
        >
          {MINUTES.map((minute) => (
            <option value={minute} key={minute}>{minute}</option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="work-schedule-editor__error" role="alert">
          {error}
        </p>
      ) : null}

      {reminderManager ? (
        <section className="work-reminders" aria-labelledby="work-reminders-title">
          <div className="work-reminders__head">
            <div>
              <p className="work-reminders__eyebrow">工位小闹钟</p>
              <h3 id="work-reminders-title">上班过程提醒</h3>
            </div>
            <Button variant="secondary" onClick={reminderManager.addReminder}>+ 加一条</Button>
          </div>
          <div className="work-reminders__list">
            {reminderManager.reminders.map((reminder) => (
              <details className="work-reminder-row" key={reminder.id}>
                <summary className="work-reminder-row__summary">
                  <time>{reminder.time}</time>
                  <span className="work-reminder-row__summary-copy">
                    <strong>{reminder.label}</strong>
                    <small>
                      {reminder.message} · 自动切到{reminderStatusLabel(reminder.suggestedStatus)}
                    </small>
                  </span>
                  <span className="work-reminder-row__state">
                    {reminder.enabled ? "已开" : "已关"}
                  </span>
                </summary>
                <div className="work-reminder-row__editor">
                  <div className="work-reminder-row__top">
                    <label className="work-reminder-row__toggle">
                      <input
                        type="checkbox"
                        checked={reminder.enabled}
                        onChange={(event) => reminderManager.updateReminder(reminder.id, {
                          enabled: event.target.checked,
                        })}
                      />
                      <span>{reminder.enabled ? "开着" : "歇会"}</span>
                    </label>
                    <input
                      className="work-reminder-row__time"
                      type="time"
                      aria-label={`${reminder.label}提醒时间`}
                      value={reminder.time}
                      onChange={(event) => reminderManager.updateReminder(reminder.id, {
                        time: event.target.value,
                      })}
                    />
                    <input
                      className="work-reminder-row__label"
                      aria-label="提醒名称"
                      value={reminder.label}
                      onChange={(event) => reminderManager.updateReminder(reminder.id, {
                        label: event.target.value,
                      })}
                    />
                    <button
                      type="button"
                      className="work-reminder-row__remove"
                      aria-label={`删除${reminder.label}提醒`}
                      onClick={() => reminderManager.removeReminder(reminder.id)}
                    >×</button>
                  </div>
                  <input
                    className="work-reminder-row__message"
                    aria-label={`${reminder.label}提醒文案`}
                    value={reminder.message}
                    onChange={(event) => reminderManager.updateReminder(reminder.id, {
                      message: event.target.value,
                    })}
                  />
                  <label className="work-reminder-row__status">
                    <span>到点建议</span>
                    <select
                      aria-label={`${reminder.label}建议状态`}
                      value={reminder.suggestedStatus}
                      onChange={(event) => reminderManager.updateReminder(reminder.id, {
                        suggestedStatus: event.target.value,
                      })}
                    >
                      {REMINDER_STATUS_OPTIONS.map((option) => (
                        <option value={option.value} key={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </details>
            ))}
          </div>
          <p className="work-reminders__note">到点会自动切换状态；关闭的提醒不会触发。</p>
        </section>
      ) : null}
    </div>
  );
}
