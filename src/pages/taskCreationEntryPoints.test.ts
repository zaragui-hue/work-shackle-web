import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("task creation entry points", () => {
  const todayPage = readSource("src/pages/TodayPage.tsx");
  const tasksPage = readSource("src/pages/TasksPage.tsx");

  it("opens task creation from TodayPage with a drawer", () => {
    expect(todayPage).toContain('import { CreateTaskDrawer }');
    expect(todayPage).toContain("<CreateTaskDrawer");
    expect(todayPage).not.toContain("CreateTaskModal");
  });

  it("keeps TasksPage read-only with no creation entry", () => {
    expect(tasksPage).not.toContain("CreateTaskDrawer");
    expect(tasksPage).not.toContain("CreateTaskModal");
    expect(tasksPage).not.toContain("createOpen");
    expect(tasksPage).not.toContain(">新建任务</Button>");
  });
});
