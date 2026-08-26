import { format } from "date-fns";

const LOCAL_MINUTE_FORMAT = "yyyy-MM-dd'T'HH:mm";

export function formatLocalMinute(value: Date): string {
  return format(value, LOCAL_MINUTE_FORMAT);
}

export function currentMinuteValue(now = new Date()): string {
  const rounded = new Date(now);
  if (rounded.getSeconds() > 0 || rounded.getMilliseconds() > 0) {
    rounded.setMinutes(rounded.getMinutes() + 1);
  }
  rounded.setSeconds(0, 0);
  return formatLocalMinute(rounded);
}

export function splitDateTime(value: string): { date: string; time: string } {
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

export function combineDateTime(date: string, time: string): string {
  return date && time ? `${date}T${time}` : "";
}

export function addMinutesToDateTime(value: string, minutes: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  date.setMinutes(date.getMinutes() + minutes);
  return formatLocalMinute(date);
}

export function isBeforeCurrentMinute(
  value: string,
  now = new Date(),
): boolean {
  const valueMs = new Date(value).getTime();
  const minimumMs = new Date(currentMinuteValue(now)).getTime();
  return Number.isFinite(valueMs) && valueMs < minimumMs;
}
