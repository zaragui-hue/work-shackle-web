const CLOCK_PATTERN = /^(\d{2}):(\d{2})$/;

function parseClock(clock: string): [number, number] {
  const match = CLOCK_PATTERN.exec(clock);
  if (!match) {
    throw new Error("invalid clock value");
  }
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error("invalid clock value");
  }
  return [hours, minutes];
}

export function nextDeadlineFromClock(
  clock: string,
  nowMs = Date.now(),
): number {
  const [hours, minutes] = parseClock(clock);
  const next = new Date(nowMs);
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= nowMs) {
    next.setDate(next.getDate() + 1);
  }
  return next.getTime();
}

export function defaultExplosionPostponeClock(nowMs = Date.now()): string {
  const next = new Date(nowMs);
  next.setHours(next.getHours() + 1, next.getMinutes(), 0, 0);
  return `${String(next.getHours()).padStart(2, "0")}:${String(
    next.getMinutes(),
  ).padStart(2, "0")}`;
}
