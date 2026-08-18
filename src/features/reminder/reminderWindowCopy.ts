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
    case "ddl_60":
      return SYSTEM_HEADLINES.ddl_60;
    case "ddl_30":
      return SYSTEM_HEADLINES.ddl_30;
    case "ddl_10":
      return SYSTEM_HEADLINES.ddl_10;
    case "ddl_due":
      return SYSTEM_HEADLINES.ddl_due;
    default:
      return SYSTEM_HEADLINES.fallback;
  }
}

export function reminderRemainingLabel(payload: ReminderTriggeredPayload): string {
  if (payload.kind === "custom") {
    return SYSTEM_REMAINING.custom;
  }

  switch (payload.reminderKind) {
    case "ddl_60":
      return SYSTEM_REMAINING.ddl_60;
    case "ddl_30":
      return SYSTEM_REMAINING.ddl_30;
    case "ddl_10":
      return SYSTEM_REMAINING.ddl_10;
    case "ddl_due":
      return SYSTEM_REMAINING.ddl_due;
    default:
      return SYSTEM_REMAINING.fallback;
  }
}

export function reminderKindLabel(payload: ReminderTriggeredPayload): string {
  if (payload.kind === "custom") {
    return SYSTEM_KINDS.custom;
  }

  switch (payload.reminderKind) {
    case "ddl_60":
      return SYSTEM_KINDS.ddl_60;
    case "ddl_30":
      return SYSTEM_KINDS.ddl_30;
    case "ddl_10":
      return SYSTEM_KINDS.ddl_10;
    case "ddl_due":
      return SYSTEM_KINDS.ddl_due;
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
