import { describe, expect, it, vi } from "vitest";
import { createDefaultData } from "./defaultData";
import { changeTaskStatus, createTask, postponeTask, queryTodayTasks } from "./tasks";

vi.stubGlobal("crypto", { randomUUID: () => `id-${Math.random()}` });

const at = (hour: number, day = 27) => new Date(2026, 7, day, hour).getTime();

describe("today task rules", () => {
  it("creates and groups a task for today", () => {
    const data = createTask(createDefaultData(at(8)), { title: "准备评审材料", plannedAtMs: at(9), deadlineAtMs: at(18), priority: 2 }, at(8));
    expect(queryTodayTasks(data, at(10)).formalTasks.map((task) => task.title)).toEqual(["准备评审材料"]);
  });

  it("keeps completed and postponed history", () => {
    const created = createTask(createDefaultData(at(8)), { title: "准备评审材料", plannedAtMs: at(9), deadlineAtMs: at(18), priority: 2 }, at(8));
    const task = created.tasks[0];
    const postponed = postponeTask(created, task.id, at(18, 28), "等待需求确认", at(11));
    expect(postponed.postponements[0]).toMatchObject({ taskId: task.id, reason: "等待需求确认" });
    const completed = changeTaskStatus(postponed, task.id, "completed", at(17));
    expect(queryTodayTasks(completed, at(17)).completedTodayTasks[0]?.id).toBe(task.id);
  });

  it("does not duplicate an overdue task in the formal group", () => {
    const created = createTask(createDefaultData(at(8)), { title: "旧任务", plannedAtMs: at(9, 26), deadlineAtMs: at(18, 26), priority: 1 }, at(8, 26));
    const today = queryTodayTasks(created, at(10));
    expect(today.overdueTasks).toHaveLength(1);
    expect(today.formalTasks).toHaveLength(0);
  });

  it("rejects a deadline before the planned time", () => {
    expect(() => createTask(createDefaultData(at(8)), { title: "倒流", plannedAtMs: at(18), deadlineAtMs: at(9), priority: 1 }, at(8))).toThrow("DDL 不能早于计划时间");
  });
});
