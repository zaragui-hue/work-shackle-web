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

const oneHourPayload: ReminderTriggeredPayload = {
  kind: "system",
  taskId: "t2",
  taskTitle: "提交方案",
  reminderKind: "one_hour_remaining",
  deadlineSnapshotMs: 20_000,
  triggerAtMs: 10_200_000,
  firedAtMs: 10_200_000,
};

describe("reminderWindowCopy", () => {
  it("uses the confirmed anti-work system copy", () => {
    expect(reminderHeadline(oneHourPayload)).toBe(
      "最后一小时。现在开始努力，至少能显得之前不是纯摸鱼。",
    );
    expect(reminderRemainingLabel(oneHourPayload)).toBe("距离完成时间仅剩 1 小时");
    expect(reminderKindLabel(oneHourPayload)).toBe("最后一小时");
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
    expect(reminderEmotion(oneHourPayload).emoji).toBe("😟");
    expect(
      reminderEmotion({
        ...oneHourPayload,
        reminderKind: "progress_half",
      }).emoji,
    ).toBe("🙂");
  });

  it("formats additional task count copy", () => {
    expect(additionalTasksLabel(0)).toBeNull();
    expect(additionalTasksLabel(2)).toBe("还有 2 个任务也在催");
  });
});
