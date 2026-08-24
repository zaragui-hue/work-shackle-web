import { afterEach, describe, expect, it, vi } from "vitest";

import { createDefaultFormValues, createTaskFormSchema, toCreateTaskInput } from "./createTaskForm";

afterEach(() => vi.useRealTimers());

describe("createTaskForm", () => {
  it("defaults to the current minute and today at 18:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 9, 17, 43));
    expect(createDefaultFormValues()).toMatchObject({
      startAt: "2026-08-24T09:17",
      endAt: "2026-08-24T18:00",
      priority: 2,
      contactName: "",
    });
  });

  it("moves completion to tomorrow after 18:00", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 24, 18, 1));
    expect(createDefaultFormValues().endAt).toBe("2026-08-25T18:00");
  });

  it("requires completion to be later than start", () => {
    const result = createTaskFormSchema.safeParse({
      ...createDefaultFormValues(new Date(2026, 7, 24, 9, 0)),
      title: "交方案",
      endAt: "2026-08-24T09:00",
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe("完成时间必须晚于开始时间");
  });

  it("maps the time range and free-text contact", () => {
    expect(toCreateTaskInput({
      title: "交方案",
      note: "",
      startAt: "2026-08-24T09:00",
      endAt: "2026-08-24T18:00",
      priority: 2,
      contactName: " 小王 ",
    })).toMatchObject({
      plannedAtMs: new Date("2026-08-24T09:00").getTime(),
      deadlineAtMs: new Date("2026-08-24T18:00").getTime(),
      priority: 2,
      contactSnapshot: "小王",
    });
  });
});
