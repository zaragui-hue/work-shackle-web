export type WorkCountdownPhase = "before_start" | "working" | "after_end";

export type WorkCountdownInput = {
  workDate: string;
  effectiveStart: string;
  effectiveEnd: string;
};

export type WorkCountdownDisplay = {
  phase: WorkCountdownPhase;
  primaryText: string;
  countdownText: string | null;
};

export function parseClockTimeOnDate(workDate: string, clockTime: string): Date {
  const [hours, minutes] = clockTime.split(":").map(Number);
  const [year, month, day] = workDate.split("-").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function formatHmsCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function computeWorkCountdown(
  schedule: WorkCountdownInput,
  nowMs: number,
): WorkCountdownDisplay {
  const startAt = parseClockTimeOnDate(schedule.workDate, schedule.effectiveStart);
  const endAt = parseClockTimeOnDate(schedule.workDate, schedule.effectiveEnd);
  const now = nowMs;

  if (now < startAt.getTime()) {
    return {
      phase: "before_start",
      primaryText: `今天 ${schedule.effectiveStart} 开工`,
      countdownText: null,
    };
  }

  if (now >= endAt.getTime()) {
    return {
      phase: "after_end",
      primaryText: "今天已经到下班时间",
      countdownText: null,
    };
  }

  const remainingMs = endAt.getTime() - now;
  return {
    phase: "working",
    primaryText: "距离下班还有",
    countdownText: formatHmsCountdown(remainingMs),
  };
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
