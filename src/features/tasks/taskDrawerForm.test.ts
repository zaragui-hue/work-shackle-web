import { describe, expect, it } from "vitest";

import type { TaskDetail } from "../../services/tauri/tasks";
import {
  taskDetailToFormValues,
  taskDrawerFormSchema,
  toUpdateTaskInput,
} from "./taskDrawerForm";

const detail: TaskDetail = {
  task: {
    id: "task-1",
    title: "整理季度复盘",
    note: "带数据",
    plannedAtMs: new Date(2026, 7, 26, 9, 0).getTime(),
    deadlineAtMs: new Date(2026, 7, 26, 18, 0).getTime(),
    priority: 4,
    status: "in_progress",
    contactId: "contact-1",
    contactSnapshot: "小王",
    createdAtMs: new Date(2026, 7, 25, 9, 0).getTime(),
    updatedAtMs: new Date(2026, 7, 25, 9, 0).getTime(),
  },
  reminders: [],
  postponements: [],
};

describe("taskDrawerForm", () => {
  it("maps every core task field into the edit form", () => {
    expect(taskDetailToFormValues(detail)).toEqual({
      title: "整理季度复盘",
      note: "带数据",
      startAt: "2026-08-26T09:00",
      endAt: "2026-08-26T18:00",
      priority: 4,
      contactName: "小王",
      status: "in_progress",
    });
  });

  it("locks time and status out of autosave after the task has started", () => {
    expect(toUpdateTaskInput(detail.task, {
      title: " 改后的任务 ",
      note: " 更新备注 ",
      startAt: "2026-08-26T10:00",
      endAt: "2026-08-26T19:00",
      priority: 5,
      contactName: " 新对接人 ",
      status: "paused",
    })).toEqual({
      id: "task-1",
      title: "改后的任务",
      note: "更新备注",
      priority: 5,
      contactId: null,
      contactSnapshot: "新对接人",
    });
  });

  it("includes time edits while a task is still not started", () => {
    const task = { ...detail.task, status: "not_started" as const };
    expect(toUpdateTaskInput(task, {
      ...taskDetailToFormValues({ ...detail, task }),
      startAt: "2026-08-26T10:00",
      endAt: "2026-08-26T19:00",
    })).toMatchObject({
      plannedAtMs: new Date("2026-08-26T10:00").getTime(),
      deadlineAtMs: new Date("2026-08-26T19:00").getTime(),
    });
  });

  it("keeps the linked contact when its snapshot is unchanged", () => {
    expect(toUpdateTaskInput(detail.task, {
      ...taskDetailToFormValues(detail),
      contactName: " 小王 ",
    })).toMatchObject({
      contactId: "contact-1",
      contactSnapshot: "小王",
    });
  });

  it("requires completion to be later than start", () => {
    const result = taskDrawerFormSchema.safeParse({
      ...taskDetailToFormValues(detail),
      endAt: "2026-08-26T09:00",
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("完成时间必须晚于开始时间");
  });
});
