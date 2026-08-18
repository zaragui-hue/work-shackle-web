import { describe, expect, it } from "vitest";

import type { ReminderTriggeredPayload } from "../../services/tauri/reminder";
import {
  additionalTasksLabel,
  reminderEmotion,
  reminderHeadline,
  reminderKindLabel,
  reminderRemainingLabel,
} from "./reminderWindowCopy";

const customPayload: ReminderTriggeredPayload = {
  kind: "custom",
  reminderId: "r1",
  taskId: "t1",
  taskTitle: "写周报",
  remindAtMs: 1000,
  firedAtMs: 1000,
  message: "别忘了交",
};

const ddl10Payload: ReminderTriggeredPayload = {
  kind: "system",
  taskId: "t2",
  taskTitle: "提交方案",
  reminderKind: "ddl_10",
  deadlineSnapshotMs: 20_000,
  triggerAtMs: 10_200_000,
  firedAtMs: 10_200_000,
};

describe("reminderWindowCopy", () => {
  it("uses frozen system ddl copy", () => {
    expect(reminderHeadline(ddl10Payload)).toBe("距离 DDL 还有 10 分钟");
    expect(reminderRemainingLabel(ddl10Payload)).toBe("剩余约 10 分钟");
    expect(reminderKindLabel(ddl10Payload)).toBe("DDL 前 10 分钟");
  });

  it("uses custom message when provided", () => {
    expect(reminderHeadline(customPayload)).toBe("别忘了交");
    expect(reminderKindLabel(customPayload)).toBe("自定义提醒");
  });

  it("falls back for custom reminder without message", () => {
    expect(
      reminderHeadline({
        ...customPayload,
        message: undefined,
      }),
    ).toBe("该提醒啦");
  });

  it("maps urgency emotions for system reminders", () => {
    expect(reminderEmotion(ddl10Payload).emoji).toBe("😟");
    expect(
      reminderEmotion({
        ...ddl10Payload,
        reminderKind: "ddl_due",
      }).emoji,
    ).toBe("😱");
  });

  it("formats additional task count copy", () => {
    expect(additionalTasksLabel(0)).toBeNull();
    expect(additionalTasksLabel(2)).toBe("还有 2 个任务也在催");
  });
});
