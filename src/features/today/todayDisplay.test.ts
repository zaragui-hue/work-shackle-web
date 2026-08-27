import { describe, expect, it } from "vitest";

import {
  countVisibleTodayTasks,
  dedupeTodayTaskGroups,
  isTodayFullyEmpty,
  overdueTreatmentPrompt,
} from "./todayDisplay";

describe("countVisibleTodayTasks", () => {
  it("does not count the upcoming summary collection", () => {
    expect(
      countVisibleTodayTasks({
        formalTasks: [{ id: "formal" }],
        upcomingDeadlineTasks: [{ id: "formal" }],
        overdueTasks: [{ id: "overdue" }],
      }),
    ).toBe(2);
  });
});

describe("isTodayFullyEmpty", () => {
  it("ignores the retired upcoming summary collection", () => {
    expect(
      isTodayFullyEmpty({
        formalTasks: [],
        upcomingDeadlineTasks: [{ id: "retired-summary-item" }],
        overdueTasks: [],
        completedTodayTasks: [],
      }),
    ).toBe(true);
  });
});

describe("dedupeTodayTaskGroups", () => {
  it("keeps overdue tasks and removes duplicate formal tasks without reordering", () => {
    const formalTasks = [
      { id: "first", title: "先做" },
      { id: "debt", title: "跨日任务" },
      { id: "last", title: "后做" },
    ];
    const overdueTasks = [{ id: "debt", title: "跨日任务" }];

    expect(dedupeTodayTaskGroups(formalTasks, overdueTasks)).toEqual({
      formalTasks: [formalTasks[0], formalTasks[2]],
      overdueTasks,
    });
  });
});

describe("overdueTreatmentPrompt", () => {
  const hour = 60 * 60 * 1_000;
  const nowMs = new Date(2026, 7, 27, 12, 0).getTime();

  it("urges a quick rescue during the first overdue day", () => {
    expect(overdueTreatmentPrompt(nowMs - 3 * hour, nowMs)).toBe(
      "尸体还热。五分钟能回就快回，不行就延期，别装死。",
    );
  });

  it("asks for priority handling after one overdue day", () => {
    expect(overdueTreatmentPrompt(nowMs - 36 * hour, nowMs)).toBe(
      "它已经在工位上扎根了。建议优先处理，今天别再养它。",
    );
  });

  it("suggests rescheduling or ending after three overdue days", () => {
    expect(overdueTreatmentPrompt(nowMs - 96 * hour, nowMs)).toBe(
      "这活已经获得永久工位。要么重排，要么结束，别再供着。",
    );
  });
});
