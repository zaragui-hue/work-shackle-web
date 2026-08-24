import { copy } from "../../config/copy";
import type { ReminderTriggeredPayload } from "../../services/tauri/reminder";

export type ReminderEmotion = {
  emoji: string;
  label: string;
};

const SYSTEM_HEADLINES = copy.reminder.headline;
const SYSTEM_REMAINING = copy.reminder.remaining;
const SYSTEM_KINDS = copy.reminder.kind;

export function reminderEmotion(payload: ReminderTriggeredPayload): ReminderEmotion {
  if (payload.kind === "custom") {
    return copy.reminder.customEmotion;
  }
  return copy.reminder.emotion[
    payload.reminderKind as keyof typeof copy.reminder.emotion
  ] ?? copy.reminder.fallbackEmotion;
}

export function reminderHeadline(payload: ReminderTriggeredPayload): string {
  if (payload.kind === "custom") {
    if (payload.message?.trim()) {
      return payload.message.trim();
    }
    return SYSTEM_HEADLINES.customFallback;
  }

  switch (payload.reminderKind) {
    case "progress_half":
      return SYSTEM_HEADLINES.progress_half;
    case "quarter_remaining":
      return SYSTEM_HEADLINES.quarter_remaining;
    case "one_hour_remaining":
      return SYSTEM_HEADLINES.one_hour_remaining;
    default:
      return SYSTEM_HEADLINES.fallback;
  }
}

export function reminderRemainingLabel(payload: ReminderTriggeredPayload): string {
  if (payload.kind === "custom") {
    return SYSTEM_REMAINING.custom;
  }

  switch (payload.reminderKind) {
    case "progress_half":
      return SYSTEM_REMAINING.progress_half;
    case "quarter_remaining":
      return SYSTEM_REMAINING.quarter_remaining;
    case "one_hour_remaining":
      return SYSTEM_REMAINING.one_hour_remaining;
    default:
      return SYSTEM_REMAINING.fallback;
  }
}

export function reminderKindLabel(payload: ReminderTriggeredPayload): string {
  if (payload.kind === "custom") {
    return SYSTEM_KINDS.custom;
  }

  switch (payload.reminderKind) {
    case "progress_half":
      return SYSTEM_KINDS.progress_half;
    case "quarter_remaining":
      return SYSTEM_KINDS.quarter_remaining;
    case "one_hour_remaining":
      return SYSTEM_KINDS.one_hour_remaining;
    default:
      return SYSTEM_KINDS.fallback;
  }
}

export function additionalTasksLabel(additionalCount: number): string | null {
  if (additionalCount <= 0) {
    return null;
  }
  return `还有 ${additionalCount} 个任务也在催`;
}
