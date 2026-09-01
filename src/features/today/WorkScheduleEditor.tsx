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
import { CompactClockSelect } from "./CompactClockSelect";
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
  const [clearConfirming, setClearConfirming] = useState(false);
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
        <CompactClockSelect
          label="下班小时"
          value={selectedEndTime.hour}
          values={HOURS}
          disabled={saving}
          onSelect={(hour) => {
            void persist(`${hour}:${selectedEndTime.minute}`);
          }}
        />
        <span aria-hidden="true">:</span>
        <CompactClockSelect
          label="下班分钟"
          value={selectedEndTime.minute}
          values={MINUTES}
          disabled={saving}
          onSelect={(minute) => {
            void persist(`${selectedEndTime.hour}:${minute}`);
          }}
        />
      </div>
      {error ? (
        <p className="work-schedule-editor__error" role="alert">
          {error}
        </p>
      ) : null}

      {reminderManager ? (
        <section className="work-reminders" aria-labelledby="work-reminders-title">
          <div className="work-reminders__head">
            <h3 id="work-reminders-title">工位小闹钟</h3>
            <div className="work-reminders__head-actions">
              {clearConfirming ? (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => setClearConfirming(false)}
                  >取消</Button>
                  <Button
                    className="work-reminders__clear-confirm"
                    onClick={() => {
                      if (reminderManager.clearAll()) {
                        setClearConfirming(false);
                      }
                    }}
                  >确认清空</Button>
                </>
              ) : (
                <Button
                  variant="secondary"
                  disabled={Boolean(reminderManager.draft) || reminderManager.reminders.length === 0}
                  onClick={() => setClearConfirming(true)}
                >清空全部</Button>
              )}
              {!clearConfirming ? (
                <Button
                  variant="wheat"
                  disabled={Boolean(reminderManager.draft)}
                  onClick={reminderManager.startAdd}
                >＋ 添加</Button>
              ) : null}
            </div>
          </div>
          {reminderManager.draft ? (
            <p className="work-reminders__editing-hint">
              请先保存或取消当前修改
            </p>
          ) : null}
          {reminderManager.storageError ? (
            <p className="work-reminders__error" role="alert">
              {reminderManager.storageError}
            </p>
          ) : null}
          <div className="work-reminders__list">
            {reminderManager.reminders.length === 0 && !reminderManager.draft ? (
              <p className="work-reminders__empty">
                还没有小闹钟，添加后每天沿用。
              </p>
            ) : null}
            {reminderManager.reminders.map((reminder) =>
              reminderManager.draft?.mode === "edit"
                && reminderManager.draft.value.id === reminder.id ? (
                  <WorkReminderRangeEditor
                    key={reminder.id}
                    manager={reminderManager}
                  />
                ) : (
                  <button
                    type="button"
                    className="work-reminder-row"
                    key={reminder.id}
                    disabled={Boolean(reminderManager.draft)}
                    onClick={() => reminderManager.startEdit(reminder.id)}
                  >
                    <time>{reminder.startTime}–{reminder.endTime}</time>
                    <strong>{reminderStatusLabel(reminder.statusType)}</strong>
                    <span>编辑 ›</span>
                  </button>
                ),
            )}
            {reminderManager.draft?.mode === "create" ? (
              <WorkReminderRangeEditor manager={reminderManager} />
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function WorkReminderRangeEditor({
  manager,
}: {
  manager: WorkdayReminderManager;
}) {
  const draft = manager.draft;
  if (!draft) {
    return null;
  }
  const reminder = draft.value;
  const start = splitClock(reminder.startTime);
  const end = splitClock(reminder.endTime);

  return (
    <div className="work-reminder-row__editor">
      <div className="work-reminder-row__actions">
        <strong>{draft.mode === "create" ? "添加小闹钟" : "编辑小闹钟"}</strong>
        {draft.mode === "edit" ? (
          <button
            type="button"
            className="work-reminder-row__delete"
            onClick={manager.deleteDraftReminder}
          >删除</button>
        ) : null}
      </div>

      <div className="work-reminder-row__range" aria-label="提醒时间段">
        <fieldset>
          <legend>开始时间</legend>
          <div className="work-reminder-row__clock">
            <CompactClockSelect
              label="开始小时"
              value={start.hour}
              values={HOURS}
              onSelect={(hour) => manager.updateDraft({
                startTime: `${hour}:${start.minute}`,
              })}
            />
            <span aria-hidden="true">:</span>
            <CompactClockSelect
              label="开始分钟"
              value={start.minute}
              values={MINUTES}
              onSelect={(minute) => manager.updateDraft({
                startTime: `${start.hour}:${minute}`,
              })}
            />
          </div>
        </fieldset>
        <fieldset>
          <legend>结束时间</legend>
          <div className="work-reminder-row__clock">
            <CompactClockSelect
              label="结束小时"
              value={end.hour}
              values={HOURS}
              onSelect={(hour) => manager.updateDraft({
                endTime: `${hour}:${end.minute}`,
              })}
            />
            <span aria-hidden="true">:</span>
            <CompactClockSelect
              label="结束分钟"
              value={end.minute}
              values={MINUTES}
              onSelect={(minute) => manager.updateDraft({
                endTime: `${end.hour}:${minute}`,
              })}
            />
          </div>
        </fieldset>
      </div>

      <label className="work-reminder-row__status">
        <span>内容</span>
        <select
          aria-label="提醒内容"
          value={reminder.statusType ?? ""}
          onChange={(event) => manager.updateDraft({
            statusType: event.target.value || null,
          })}
        >
          <option value="">请选择</option>
          {REMINDER_STATUS_OPTIONS.map((option) => (
            <option value={option.value} key={option.value}>{option.label}</option>
          ))}
        </select>
      </label>

      {draft.error ? (
        <p className="work-reminder-row__error" role="alert">{draft.error}</p>
      ) : null}
      <div className="work-reminder-row__footer">
        <Button variant="secondary" onClick={manager.cancelDraft}>取消</Button>
        <Button onClick={manager.saveDraft}>保存</Button>
      </div>
    </div>
  );
}
