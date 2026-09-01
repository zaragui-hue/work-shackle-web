import type { WorkSchedule } from "../../services/tauri/settings";
import { isReminderWorkStatus } from "./workStatusOptions";

export type WorkdayReminder = {
  id: string;
  startTime: string;
  endTime: string;
  statusType: string;
  createdAtMs: number;
};

export type WorkdayReminderDraftValue = Omit<WorkdayReminder, "statusType"> & {
  statusType: string | null;
};

type LegacyWorkdayReminder = {
  id?: unknown;
  time?: unknown;
  suggestedStatus?: unknown;
  enabled?: unknown;
};

export const WORKDAY_REMINDER_STORAGE_KEY = "work-shackle.workday-reminders.v3";
export const V2_WORKDAY_REMINDER_STORAGE_KEY = "work-shackle.workday-reminders.v2";
export const LEGACY_WORKDAY_REMINDER_STORAGE_KEY = "work-shackle.workday-reminders.v1";

export const REMINDER_STATUS_OPTIONS = [
  { value: "meeting", label: "会议中" },
  { value: "urgent_insert", label: "临时插单" },
  { value: "chased_by_requirements", label: "被需求追杀" },
  { value: "slacking", label: "摸鱼中" },
  { value: "gossip", label: "八卦一下" },
  { value: "drinking", label: "喝点东西" },
  { value: "lunch", label: "午餐中" },
  { value: "nap", label: "午休续命" },
  { value: "daydream", label: "发会儿呆" },
] as const;

const REMINDER_STATUS_IDS = new Set<string>(
  REMINDER_STATUS_OPTIONS.map((option) => option.value),
);

export const DEFAULT_WORKDAY_REMINDERS: WorkdayReminder[] = [
  {
    id: "water-1030",
    startTime: "10:30",
    endTime: "11:00",
    statusType: "drinking",
    createdAtMs: 1,
  },
  {
    id: "lunch-1200",
    startTime: "12:00",
    endTime: "13:00",
    statusType: "lunch",
    createdAtMs: 2,
  },
  {
    id: "coffee-1500",
    startTime: "15:00",
    endTime: "15:30",
    statusType: "drinking",
    createdAtMs: 3,
  },
];

export function isAllowedReminderStatus(statusType: string | null): boolean {
  return Boolean(
    statusType
      && isReminderWorkStatus(statusType)
      && REMINDER_STATUS_IDS.has(statusType),
  );
}

export function reminderStatusLabel(status: string | null): string {
  return REMINDER_STATUS_OPTIONS.find((option) => option.value === status)?.label
    ?? "请选择内容";
}

export function sortWorkdayReminders(
  reminders: WorkdayReminder[],
): WorkdayReminder[] {
  return [...reminders].sort((left, right) =>
    left.startTime.localeCompare(right.startTime)
      || left.endTime.localeCompare(right.endTime)
      || left.createdAtMs - right.createdAtMs,
  );
}

export function validateWorkdayReminder(
  candidate: WorkdayReminderDraftValue,
  reminders: WorkdayReminder[],
  schedule?: WorkSchedule | null,
): string | null {
  if (!isClock(candidate.startTime) || !isClock(candidate.endTime)) {
    return "请选择有效的开始和结束时间";
  }
  if (candidate.startTime >= candidate.endTime) {
    return "结束时间必须晚于开始时间";
  }
  if (!isAllowedReminderStatus(candidate.statusType)) {
    return "请选择提醒内容";
  }
  if (
    schedule
    && (
      candidate.startTime < schedule.effectiveStart
      || candidate.endTime > schedule.effectiveEnd
    )
  ) {
    return `时间段需在排班 ${schedule.effectiveStart}–${schedule.effectiveEnd} 内`;
  }
  const overlaps = reminders.some((reminder) =>
    reminder.id !== candidate.id
      && candidate.startTime < reminder.endTime
      && candidate.endTime > reminder.startTime,
  );
  return overlaps ? "该时间段与已有小闹钟冲突" : null;
}

export function createWorkdayReminder(nowMs = Date.now()): WorkdayReminderDraftValue {
  const next = new Date(nowMs);
  next.setSeconds(0, 0);
  next.setMinutes(0);
  next.setHours(next.getHours() + 1);
  const startTime = formatClock(next);
  return {
    id: `reminder-${nowMs}`,
    startTime,
    endTime: addClockMinutes(startTime, 30),
    statusType: null,
    createdAtMs: nowMs,
  };
}

export function findActiveWorkdayReminder({
  reminders,
  workDate,
  nowMs,
}: {
  reminders: WorkdayReminder[];
  workDate: string;
  nowMs: number;
}): WorkdayReminder | null {
  return sortWorkdayReminders(reminders).find((reminder) => {
    if (!isAllowedReminderStatus(reminder.statusType)) {
      return false;
    }
    const startAt = clockOnDate(workDate, reminder.startTime);
    const endAt = clockOnDate(workDate, reminder.endTime);
    return nowMs >= startAt && nowMs < endAt;
  }) ?? null;
}

export function loadWorkdayReminders(
  storage: Storage | null,
  schedule?: WorkSchedule | null,
): WorkdayReminder[] {
  if (!storage) {
    return cloneDefaults();
  }
  try {
    const currentRaw = storage.getItem(WORKDAY_REMINDER_STORAGE_KEY);
    if (currentRaw) {
      const normalized = normalizeV3(JSON.parse(currentRaw) as unknown);
      return sortWorkdayReminders(normalized);
    }

    const v2Raw = storage.getItem(V2_WORKDAY_REMINDER_STORAGE_KEY);
    if (v2Raw) {
      if (!schedule) {
        return [];
      }
      const migrated = migrateV2(JSON.parse(v2Raw) as unknown, schedule);
      storage.setItem(WORKDAY_REMINDER_STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }

    const legacyRaw = storage.getItem(LEGACY_WORKDAY_REMINDER_STORAGE_KEY);
    if (!legacyRaw) {
      return cloneDefaults();
    }
    if (!schedule) {
      return [];
    }
    const migrated = migrateLegacy(JSON.parse(legacyRaw) as unknown, schedule);
    const result = sortWorkdayReminders(migrated);
    storage.setItem(WORKDAY_REMINDER_STORAGE_KEY, JSON.stringify(result));
    return result;
  } catch {
    return cloneDefaults();
  }
}

export function saveWorkdayReminders(
  storage: Storage | null,
  reminders: WorkdayReminder[],
): void {
  storage?.setItem(
    WORKDAY_REMINDER_STORAGE_KEY,
    JSON.stringify(sortWorkdayReminders(reminders)),
  );
}

function migrateLegacy(
  value: unknown,
  schedule?: WorkSchedule | null,
): WorkdayReminder[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const migrated: WorkdayReminder[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const legacy = item as LegacyWorkdayReminder;
    if (
      typeof legacy.id !== "string"
      || typeof legacy.time !== "string"
      || !isClock(legacy.time)
      || typeof legacy.suggestedStatus !== "string"
      || !isAllowedReminderStatus(legacy.suggestedStatus)
    ) {
      return;
    }
    const candidate: WorkdayReminder = {
      id: legacy.id,
      startTime: legacy.time,
      endTime: addClockMinutes(legacy.time, 30),
      statusType: legacy.suggestedStatus,
      createdAtMs: index + 1,
    };
    if (legacy.enabled === false || validateWorkdayReminder(candidate, migrated, schedule)) {
      return;
    }
    migrated.push(candidate);
  });
  return migrated;
}

function normalizeV3(value: unknown): WorkdayReminder[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const candidate = item as Partial<WorkdayReminder>;
    if (
      typeof candidate.id !== "string"
      || !isClock(candidate.startTime ?? "")
      || !isClock(candidate.endTime ?? "")
    ) {
      return [];
    }
    return [{
      id: candidate.id,
      startTime: candidate.startTime!,
      endTime: candidate.endTime!,
      statusType: typeof candidate.statusType === "string" ? candidate.statusType : null,
      createdAtMs: typeof candidate.createdAtMs === "number"
        ? candidate.createdAtMs
        : index + 1,
    }].filter((reminder): reminder is WorkdayReminder =>
      isAllowedReminderStatus(reminder.statusType),
    );
  });
}

function migrateV2(
  value: unknown,
  schedule?: WorkSchedule | null,
): WorkdayReminder[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const migrated: WorkdayReminder[] = [];
  value.forEach((item, index) => {
    if (!item || typeof item !== "object") {
      return;
    }
    const candidate = item as Partial<WorkdayReminder> & { enabled?: unknown };
    if (
      candidate.enabled !== true
      || typeof candidate.id !== "string"
      || !isClock(candidate.startTime ?? "")
      || !isClock(candidate.endTime ?? "")
      || typeof candidate.statusType !== "string"
      || !isAllowedReminderStatus(candidate.statusType)
    ) {
      return;
    }
    const reminder: WorkdayReminder = {
      id: candidate.id,
      startTime: candidate.startTime!,
      endTime: candidate.endTime!,
      statusType: candidate.statusType,
      createdAtMs: typeof candidate.createdAtMs === "number"
        ? candidate.createdAtMs
        : index + 1,
    };
    if (!validateWorkdayReminder(reminder, migrated, schedule)) {
      migrated.push(reminder);
    }
  });
  return sortWorkdayReminders(migrated);
}

function isClock(value: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return false;
  }
  const [hour, minute] = value.split(":").map(Number);
  return hour >= 0 && hour < 24 && minute >= 0 && minute < 60;
}

function addClockMinutes(clock: string, minutesToAdd: number): string {
  const [hour, minute] = clock.split(":").map(Number);
  const total = (hour * 60 + minute + minutesToAdd) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function formatClock(value: Date): string {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}

function clockOnDate(workDate: string, clock: string): number {
  const [year, month, day] = workDate.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function cloneDefaults(): WorkdayReminder[] {
  return DEFAULT_WORKDAY_REMINDERS.map((reminder) => ({ ...reminder }));
}
