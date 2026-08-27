import { STATUS_OPTIONS } from "./defaultData";
import type { OvertimeRecord, WebData, WorkStatusRecord, WorkStatusType, WorkdayReminder } from "./model";

export function localDate(ms = Date.now()): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function clockMs(date: string, clock: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

export function effectiveSchedule(data: WebData, nowMs = Date.now()) {
  const date = localDate(nowMs);
  const override = data.schedule.todayOverrides[date];
  return { workDate: date, start: override?.start ?? data.schedule.defaultStart, end: override?.end ?? data.schedule.defaultEnd, lunchStart: data.schedule.lunchStart, lunchEnd: data.schedule.lunchEnd };
}

export function countdown(data: WebData, nowMs = Date.now()) {
  const schedule = effectiveSchedule(data, nowMs);
  const startAt = clockMs(schedule.workDate, schedule.start);
  const endAt = clockMs(schedule.workDate, schedule.end);
  const target = nowMs < startAt ? startAt : endAt;
  return { phase: nowMs < startAt ? "before_start" : nowMs < endAt ? "working" : "after_end", remainingMs: Math.max(0, target - nowMs), schedule } as const;
}

export function currentStatus(data: WebData): WorkStatusRecord | undefined {
  return [...data.workStatusRecords].reverse().find((record) => record.endAtMs === undefined);
}

export function switchStatus(data: WebData, statusType: WorkStatusType, nowMs = Date.now()): WebData {
  const option = STATUS_OPTIONS.find((item) => item.id === statusType);
  if (!option) return data;
  const closed = data.workStatusRecords.map((record) => record.endAtMs === undefined ? { ...record, endAtMs: nowMs } : record);
  return { ...data, updatedAtMs: nowMs, workStatusRecords: [...closed, { id: `status-${crypto.randomUUID()}`, statusType, workDate: localDate(nowMs), displayCopy: option.copy, startAtMs: nowMs }] };
}

export function saveTodayEnd(data: WebData, end: string, nowMs = Date.now()): WebData {
  const date = localDate(nowMs);
  return { ...data, updatedAtMs: nowMs, schedule: { ...data.schedule, todayOverrides: { ...data.schedule.todayOverrides, [date]: { start: data.schedule.defaultStart, end } } } };
}

export function lunchDue(data: WebData, nowMs = Date.now()): boolean {
  const schedule = effectiveSchedule(data, nowMs);
  return nowMs >= clockMs(schedule.workDate, schedule.lunchStart) && nowMs < clockMs(schedule.workDate, schedule.lunchEnd) && !data.lunchDismissedDates.includes(schedule.workDate);
}

export function dismissLunch(data: WebData, nowMs = Date.now()): WebData {
  const date = localDate(nowMs);
  return { ...data, updatedAtMs: nowMs, lunchDismissedDates: [...new Set([...data.lunchDismissedDates, date])] };
}

export function activeOvertime(data: WebData): OvertimeRecord | undefined {
  return [...data.overtimeRecords].reverse().find((item) => item.endAtMs === undefined);
}

export function startOvertime(data: WebData, nowMs = Date.now()): WebData {
  if (activeOvertime(data)) return data;
  const record: OvertimeRecord = { id: `overtime-${crypto.randomUUID()}`, workDate: localDate(nowMs), startAtMs: nowMs, autoEndAtMs: nowMs + 4 * 60 * 60 * 1000 };
  return switchStatus({ ...data, overtimeRecords: [...data.overtimeRecords, record], workEndDecisions: [...data.workEndDecisions, { id: `decision-${crypto.randomUUID()}`, workDate: record.workDate, kind: "overtime", decidedAtMs: nowMs }] }, "overtime", nowMs);
}

export function endOvertime(data: WebData, nowMs = Date.now()): WebData {
  return { ...data, updatedAtMs: nowMs, overtimeRecords: data.overtimeRecords.map((item) => item.endAtMs === undefined ? { ...item, endAtMs: nowMs } : item), workStatusRecords: data.workStatusRecords.map((item) => item.endAtMs === undefined ? { ...item, endAtMs: nowMs } : item) };
}

export function confirmNormalOff(data: WebData, nowMs = Date.now()): WebData {
  const date = localDate(nowMs);
  return { ...data, updatedAtMs: nowMs, workEndDecisions: [...data.workEndDecisions, { id: `decision-${crypto.randomUUID()}`, workDate: date, kind: "normal", decidedAtMs: nowMs }], workStatusRecords: data.workStatusRecords.map((item) => item.endAtMs === undefined ? { ...item, endAtMs: nowMs } : item) };
}

export function dueReminder(data: WebData, nowMs = Date.now()): WorkdayReminder | undefined {
  const date = localDate(nowMs);
  return data.workdayReminders.filter((item) => item.enabled && !data.reminderFires.some((fire) => fire.key === `${date}:${item.id}`)).map((item) => ({ item, dueAt: clockMs(date, item.time) })).filter(({ dueAt }) => nowMs >= dueAt && nowMs - dueAt <= 5 * 60 * 1000).sort((a, b) => a.dueAt - b.dueAt)[0]?.item;
}

export function markReminderFired(data: WebData, reminder: WorkdayReminder, nowMs = Date.now()): WebData {
  return { ...data, updatedAtMs: nowMs, reminderFires: [...data.reminderFires, { key: `${localDate(nowMs)}:${reminder.id}`, firedAtMs: nowMs }] };
}
