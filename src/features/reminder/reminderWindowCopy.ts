import type { ReminderTriggeredPayload } from "../../services/tauri/reminder";

export type ReminderEmotion = {
  emoji: string;
  label: string;
};

const SYSTEM_EMOTIONS: Record<string, ReminderEmotion> = {
  ddl_60: { emoji: "🙂", label: "轻轻提醒" },
  ddl_30: { emoji: "😐", label: "开始催啦" },
  ddl_10: { emoji: "😟", label: "有点着急" },
  ddl_due: { emoji: "😱", label: "到点啦" },
};

const CUSTOM_EMOTION: ReminderEmotion = {
  emoji: "🙂",
  label: "自定义提醒",
};

export function reminderEmotion(payload: ReminderTriggeredPayload): ReminderEmotion {
  if (payload.kind === "custom") {
    return CUSTOM_EMOTION;
  }
  return SYSTEM_EMOTIONS[payload.reminderKind] ?? {
    emoji: "🙂",
    label: "提醒一下",
  };
}

export function reminderHeadline(payload: ReminderTriggeredPayload): string {
  if (payload.kind === "custom") {
    if (payload.message?.trim()) {
      return payload.message.trim();
    }
    return "该提醒啦";
  }

  switch (payload.reminderKind) {
    case "ddl_60":
      return "距离 DDL 还有 1 小时";
    case "ddl_30":
      return "距离 DDL 还有 30 分钟";
    case "ddl_10":
      return "距离 DDL 还有 10 分钟";
    case "ddl_due":
      return "DDL 到啦";
    default:
      return "提醒一下";
  }
}

export function reminderRemainingLabel(payload: ReminderTriggeredPayload): string {
  if (payload.kind === "custom") {
    return "提醒时间到";
  }

  switch (payload.reminderKind) {
    case "ddl_60":
      return "剩余约 1 小时";
    case "ddl_30":
      return "剩余约 30 分钟";
    case "ddl_10":
      return "剩余约 10 分钟";
    case "ddl_due":
      return "已到 DDL";
    default:
      return "请关注截止时间";
  }
}

export function reminderKindLabel(payload: ReminderTriggeredPayload): string {
  if (payload.kind === "custom") {
    return "自定义提醒";
  }

  switch (payload.reminderKind) {
    case "ddl_60":
      return "DDL 前 60 分钟";
    case "ddl_30":
      return "DDL 前 30 分钟";
    case "ddl_10":
      return "DDL 前 10 分钟";
    case "ddl_due":
      return "DDL 到点";
    default:
      return "系统提醒";
  }
}

export function additionalTasksLabel(additionalCount: number): string | null {
  if (additionalCount <= 0) {
    return null;
  }
  return `还有 ${additionalCount} 个任务也在催`;
}
