import { describe, expect, it } from "vitest";

import { countVisibleTodayTasks, isTodayFullyEmpty } from "./todayDisplay";

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
