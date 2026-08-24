export type WorkdayReminder = {
  id: string;
  time: string;
  label: string;
  message: string;
  suggestedStatus: string;
  enabled: boolean;
};

export const WORKDAY_REMINDER_STORAGE_KEY = "work-shackle.workday-reminders.v1";

export const DEFAULT_WORKDAY_REMINDERS: WorkdayReminder[] = [
  {
    id: "water-1030",
    time: "10:30",
    label: "喝水",
    message: "杯子还在，水呢？",
    suggestedStatus: "drinking",
    enabled: true,
  },
  {
    id: "lunch-1200",
    time: "12:00",
    label: "午休",
    message: "先把人类基础需求处理一下。",
    suggestedStatus: "lunch",
    enabled: true,
  },
  {
    id: "coffee-1500",
    time: "15:00",
    label: "续命",
    message: "咖啡可以续，命别全押上。",
    suggestedStatus: "drinking",
    enabled: true,
  },
  {
    id: "wrap-1730",
    time: "17:30",
    label: "收尾",
    message: "现在接的新活，明天也不会消失。",
    suggestedStatus: "preparing_leave",
    enabled: true,
  },
];

export const REMINDER_STATUS_OPTIONS = [
  { value: "working", label: "正常搬砖" },
  { value: "focus_brick", label: "专注搬砖" },
  { value: "meeting", label: "会议中" },
  { value: "urgent_insert", label: "临时插单" },
  { value: "chased_by_requirements", label: "被需求追杀" },
  { value: "drinking", label: "喝水续命" },
  { value: "lunch", label: "午休吃饭" },
  { value: "slacking", label: "合理摸鱼" },
  { value: "gossip", label: "八卦一下" },
  { value: "nap", label: "午休续命" },
  { value: "daydream", label: "发会儿呆" },
  { value: "preparing_leave", label: "准备下班" },
] as const;

export function loadWorkdayReminders(storage: Storage | null): WorkdayReminder[] {
  if (!storage) {
    return cloneDefaults();
  }
  try {
    const raw = storage.getItem(WORKDAY_REMINDER_STORAGE_KEY);
    if (!raw) {
      return cloneDefaults();
    }
    const parsed = JSON.parse(raw) as unknown;
    const normalized = normalizeReminderList(parsed);
    return normalized.length > 0 ? normalized : cloneDefaults();
  } catch {
    return cloneDefaults();
  }
}

export function saveWorkdayReminders(
  storage: Storage | null,
  reminders: WorkdayReminder[],
): void {
  if (!storage) {
    return;
  }
  storage.setItem(WORKDAY_REMINDER_STORAGE_KEY, JSON.stringify(reminders));
}

export function findDueWorkdayReminder({
  reminders,
  workDate,
  nowMs,
  handledIds,
  graceMs = 5 * 60 * 1000,
}: {
  reminders: WorkdayReminder[];
  workDate: string;
  nowMs: number;
  handledIds: Set<string>;
  graceMs?: number;
}): WorkdayReminder | null {
  const candidates = reminders
    .filter((reminder) => reminder.enabled && !handledIds.has(reminder.id))
    .map((reminder) => ({
      reminder,
      dueAt: clockOnDate(workDate, reminder.time),
    }))
    .filter(({ dueAt }) => nowMs >= dueAt && nowMs - dueAt <= graceMs)
    .sort((left, right) => left.dueAt - right.dueAt);
  return candidates[0]?.reminder ?? null;
}

export function createWorkdayReminder(nowMs = Date.now()): WorkdayReminder {
  const next = new Date(nowMs + 30 * 60 * 1000);
  const minutes = next.getMinutes() < 30 ? "30" : "00";
  const hour = next.getMinutes() < 30 ? next.getHours() : (next.getHours() + 1) % 24;
  return {
    id: `reminder-${nowMs}`,
    time: `${String(hour).padStart(2, "0")}:${minutes}`,
    label: "提醒",
    message: "到点了，换个姿势继续上班。",
    suggestedStatus: "working",
    enabled: true,
  };
}

export function reminderStatusLabel(status: string): string {
  return REMINDER_STATUS_OPTIONS.find((option) => option.value === status)?.label ?? "当前状态";
}

function normalizeReminderList(value: unknown): WorkdayReminder[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const candidate = item as Partial<WorkdayReminder>;
    if (
      typeof candidate.id !== "string" ||
      !/^\d{2}:\d{2}$/.test(candidate.time ?? "") ||
      typeof candidate.message !== "string"
    ) {
      return [];
    }
    return [{
      id: candidate.id,
      time: candidate.time!,
      label: typeof candidate.label === "string" ? candidate.label : "提醒",
      message: candidate.message,
      suggestedStatus:
        typeof candidate.suggestedStatus === "string" ? candidate.suggestedStatus : "working",
      enabled: candidate.enabled !== false,
    }];
  });
}

function clockOnDate(workDate: string, clock: string): number {
  const [year, month, day] = workDate.split("-").map(Number);
  const [hour, minute] = clock.split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

function cloneDefaults(): WorkdayReminder[] {
  return DEFAULT_WORKDAY_REMINDERS.map((reminder) => ({ ...reminder }));
}
