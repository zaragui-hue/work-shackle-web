# Today Task Urgency Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the standalone “即将到点” summary and order the single “今天要干” list by deadline urgency without double-counting upcoming tasks.

**Architecture:** Keep the existing `TodayTasksDto` IPC contract intact. Sort `formal_tasks` in Rust so urgency order is consistent at the data boundary, simplify the React board to render only `formalTasks`, and centralize the visible task count in a tested display helper.

**Tech Stack:** Rust, rusqlite, React 19, TypeScript, Vitest, Testing Library, Tauri 2

---

## File Structure

- Modify `src-tauri/src/services/task.rs`: define and verify the urgency ordering of `formal_tasks`.
- Create `src/features/today/TodayTaskBoard.test.tsx`: verify the upcoming summary is absent and formal tasks render once in server order.
- Modify `src/features/today/TodayTaskBoard.tsx`: stop rendering `upcomingDeadlineTasks` as a separate section.
- Create `src/features/today/todayDisplay.test.ts`: verify the visible task count excludes `upcomingDeadlineTasks`.
- Modify `src/features/today/todayDisplay.ts`: add the visible task count helper.
- Modify `src/pages/TodayPage.tsx`: use the count helper instead of summing the duplicate collection.

### Task 1: Sort Formal Tasks by Deadline Urgency

**Files:**
- Modify: `src-tauri/src/services/task.rs:483`
- Test: `src-tauri/src/services/task.rs:1810`

- [ ] **Step 1: Write the failing backend ordering test**

Add this test inside `mod today_tasks`:

```rust
#[test]
fn formal_tasks_put_deadlines_first_then_sort_undated_by_plan() {
    let db = open_test_database();
    insert_task(
        &db.connection,
        "undated-late",
        local_ms(TODAY, "14:00"),
        None,
    );
    insert_task(
        &db.connection,
        "future-late",
        local_ms(TODAY, "09:00"),
        Some(local_ms(TODAY, "20:00")),
    );
    insert_task(
        &db.connection,
        "past-due",
        local_ms(TODAY, "09:00"),
        Some(local_ms(TODAY, "14:00")),
    );
    insert_task(
        &db.connection,
        "future-soon",
        local_ms(TODAY, "09:00"),
        Some(local_ms(TODAY, "16:00")),
    );
    insert_task(
        &db.connection,
        "undated-early",
        local_ms(TODAY, "10:00"),
        None,
    );

    let result = query_at(&db.connection, local_ms(TODAY, "15:00"));

    assert_eq!(
        ids(&result.formal_tasks),
        vec![
            "past-due",
            "future-soon",
            "future-late",
            "undated-early",
            "undated-late",
        ]
    );
}
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml services::task::tests::today_tasks::formal_tasks_put_deadlines_first_then_sort_undated_by_plan -- --exact
```

Expected: FAIL because the current implementation sorts all formal tasks by `planned_at_ms`.

- [ ] **Step 3: Implement the formal-task comparator**

Replace the existing `formal_tasks.sort_by_key` call with:

```rust
formal_tasks.sort_by(|left, right| match (left.deadline_at_ms, right.deadline_at_ms) {
    (Some(left_deadline), Some(right_deadline)) => left_deadline
        .cmp(&right_deadline)
        .then_with(|| left.id.cmp(&right.id)),
    (Some(_), None) => std::cmp::Ordering::Less,
    (None, Some(_)) => std::cmp::Ordering::Greater,
    (None, None) => left
        .planned_at_ms
        .cmp(&right.planned_at_ms)
        .then_with(|| left.id.cmp(&right.id)),
});
```

- [ ] **Step 4: Run all today-task backend tests**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml services::task::tests::today_tasks
```

Expected: all `today_tasks` tests PASS.

- [ ] **Step 5: Commit the backend ordering change**

```bash
git add src-tauri/src/services/task.rs
git commit -m "fix: order today tasks by deadline urgency"
```

### Task 2: Remove the Standalone Upcoming Summary

**Files:**
- Create: `src/features/today/TodayTaskBoard.test.tsx`
- Modify: `src/features/today/TodayTaskBoard.tsx:75-110`

- [ ] **Step 1: Write the failing board tests**

Create `src/features/today/TodayTaskBoard.test.tsx`:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { Task, TodayTasks } from "../../services/tauri/tasks";
import { TodayTaskBoard } from "./TodayTaskBoard";

function task(id: string, title: string): Task {
  return {
    id,
    title,
    plannedAtMs: new Date(2026, 7, 24, 9, 0).getTime(),
    deadlineAtMs: new Date(2026, 7, 24, 18, 0).getTime(),
    priority: 3,
    status: "not_started",
    createdAtMs: new Date(2026, 7, 24, 8, 0).getTime(),
    updatedAtMs: new Date(2026, 7, 24, 8, 0).getTime(),
  };
}

afterEach(cleanup);

describe("TodayTaskBoard", () => {
  it("does not render an upcoming section or duplicate its tasks", () => {
    const urgent = task("urgent", "马上交稿");
    const tasks: TodayTasks = {
      formalTasks: [urgent],
      upcomingDeadlineTasks: [urgent],
      overdueTasks: [],
      completedTodayTasks: [],
    };

    render(<TodayTaskBoard tasks={tasks} />);

    expect(screen.queryByRole("heading", { name: "即将到点" })).toBeNull();
    expect(screen.getAllByText("马上交稿")).toHaveLength(1);
  });

  it("preserves the formal task order returned by the backend", () => {
    const tasks: TodayTasks = {
      formalTasks: [task("soon", "先完成"), task("later", "后完成")],
      upcomingDeadlineTasks: [],
      overdueTasks: [],
      completedTodayTasks: [],
    };

    render(<TodayTaskBoard tasks={tasks} />);

    const formalList = screen.getByRole("list", { name: "formal" });
    expect(
      within(formalList)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual(["先完成", "后完成"]);
  });
});
```

- [ ] **Step 2: Run the board test and verify it fails**

Run:

```bash
npm test -- src/features/today/TodayTaskBoard.test.tsx
```

Expected: the first test FAILS because “即将到点” and the duplicate task are currently rendered.

- [ ] **Step 3: Remove the upcoming section from the board**

Change the destructuring and render body in `TodayTaskBoard` to omit `upcomingDeadlineTasks`:

```tsx
export function TodayTaskBoard({ tasks, onSelect }: TodayTaskBoardProps) {
  const { formalTasks, overdueTasks, completedTodayTasks } = tasks;

  return (
    <div className="today-board">
      {formalTasks.length > 0 ? (
        <TodaySection title="今天要干" hint="今天正式安排">
          <TodayTaskList
            tasks={formalTasks}
            variant="formal"
            onSelect={onSelect}
            listKey="formal"
          />
        </TodaySection>
      ) : null}

      {overdueTasks.length > 0 ? (
        <TodaySection title="历史欠账" tone="debt" hint="以前遗留下来的">
          <TodayTaskList
            tasks={overdueTasks}
            variant="overdue"
            onSelect={onSelect}
            listKey="overdue"
          />
        </TodaySection>
      ) : null}

      <TodayCompletedSection tasks={completedTodayTasks} onSelect={onSelect} />
    </div>
  );
}
```

- [ ] **Step 4: Run the board tests**

Run:

```bash
npm test -- src/features/today/TodayTaskBoard.test.tsx
```

Expected: both tests PASS.

- [ ] **Step 5: Commit the board change**

```bash
git add src/features/today/TodayTaskBoard.tsx src/features/today/TodayTaskBoard.test.tsx
git commit -m "fix: remove duplicate upcoming task section"
```

### Task 3: Stop Double-Counting Upcoming Tasks

**Files:**
- Create: `src/features/today/todayDisplay.test.ts`
- Modify: `src/features/today/todayDisplay.ts:46`
- Modify: `src/pages/TodayPage.tsx:20,130-133`

- [ ] **Step 1: Write the failing count-helper test**

Create `src/features/today/todayDisplay.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { countVisibleTodayTasks } from "./todayDisplay";

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
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```bash
npm test -- src/features/today/todayDisplay.test.ts
```

Expected: FAIL because `countVisibleTodayTasks` does not exist.

- [ ] **Step 3: Add the visible-count helper**

Append to `src/features/today/todayDisplay.ts`:

```ts
export function countVisibleTodayTasks(tasks: {
  formalTasks: unknown[];
  overdueTasks: unknown[];
}): number {
  return tasks.formalTasks.length + tasks.overdueTasks.length;
}
```

- [ ] **Step 4: Use the helper on TodayPage**

Update the import:

```ts
import {
  countVisibleTodayTasks,
  isTodayFullyEmpty,
} from "../features/today/todayDisplay";
```

Replace the manual count with:

```ts
const todayTaskCount = countVisibleTodayTasks(todayTasks);
```

- [ ] **Step 5: Run the focused frontend tests**

Run:

```bash
npm test -- src/features/today/todayDisplay.test.ts src/features/today/TodayTaskBoard.test.tsx
```

Expected: all focused frontend tests PASS.

- [ ] **Step 6: Commit the count fix**

```bash
git add src/features/today/todayDisplay.ts src/features/today/todayDisplay.test.ts src/pages/TodayPage.tsx
git commit -m "fix: count visible today tasks once"
```

### Task 4: Full Verification and App Restart

**Files:**
- Verify only; no planned source changes.

- [ ] **Step 1: Run the frontend test suite**

Run:

```bash
npm test
```

Expected: all Vitest tests PASS.

- [ ] **Step 2: Run the backend test suite**

Run:

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all Rust tests PASS; existing compiler warnings are acceptable.

- [ ] **Step 3: Run the production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 4: Review only the intended diff**

Run:

```bash
git diff -- src-tauri/src/services/task.rs src/features/today/TodayTaskBoard.tsx src/features/today/TodayTaskBoard.test.tsx src/features/today/todayDisplay.ts src/features/today/todayDisplay.test.ts src/pages/TodayPage.tsx
```

Expected: the diff contains only urgency sorting, removal of the upcoming section, visible-count correction, and their tests. Preserve unrelated pre-existing worktree edits.

- [ ] **Step 5: Restart the Tauri development app**

Stop the existing `npm run tauri dev` process group, then run:

```bash
npm run tauri dev
```

Expected: Vite reports `Local: http://localhost:1420/`, Rust finishes the dev build, and the “精神状态事务所” window opens with no standalone “即将到点” section.
