# Today Task Auto-Status Broadcast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically persist `not_started → in_progress` when a task reaches its planned start time, then show a high-contrast status stamp and a temporary workhorse broadcast on the Today task card.

**Architecture:** SQLite remains the status source of truth. The Rust repository performs an idempotent conditional update and returns the IDs it changed; the Today query includes those IDs as event metadata. React schedules the next due refresh, suppresses catch-up events on first load, and renders a self-dismissing broadcast without deriving a second task status.

**Tech Stack:** Rust, rusqlite, Tauri 2, React 19, TypeScript, Vitest, Testing Library, CSS.

---

## File map

- Modify `src-tauri/src/db/repositories/task_repository.rs`: add the atomic due-task status transition and repository tests.
- Modify `src-tauri/src/services/task.rs`: coordinate due starts before Today classification and expose changed task IDs.
- Modify `src/services/tauri/tasks.ts`: add `autoStartedTaskIds` to the Today IPC contract.
- Create `src/features/today/useTaskAutoStart.ts`: schedule one refresh at the nearest future start time.
- Create `src/features/today/useTaskAutoStart.test.ts`: verify timer selection, cleanup, and rescheduling.
- Create `src/features/today/TaskAutoStartBroadcast.tsx`: render and dismiss the workhorse announcement.
- Create `src/features/today/TaskAutoStartBroadcast.css`: style the compact 48px broadcast strip and reduced motion behavior.
- Modify `src/features/today/TodayTaskCard.tsx`: replace the plain formal-task status chip with the stable status stamp and attach the broadcast.
- Modify `src/features/today/TodayTaskCard.css`: add muted/active stamp treatments and stamp animation.
- Modify `src/features/today/TodayTaskBoard.tsx`: pass live auto-start IDs and dismiss callbacks to cards; narrow list typing after Today metadata is added.
- Modify `src/features/today/TodayTaskBoard.test.tsx`: cover the stamp, broadcast, dismissal, and non-auto states.
- Modify `src/pages/TodayPage.tsx`: suppress first-load catch-up broadcasts, retain later auto-start events until dismissed, and install the next-start timer.
- Modify `src/pages/DesignPreviewPage.tsx`, `src/features/today/todayDisplay.test.ts`, and Today-task fixtures: add the new empty metadata array to typed `TodayTasks` values.

### Task 1: Persist due task starts atomically

**Files:**
- Modify: `src-tauri/src/db/repositories/task_repository.rs`

- [ ] **Step 1: Write failing repository tests**

Add tests beside the current create/update repository tests. The first test covers selection and returned IDs; the second proves idempotence and protects manual states.

```rust
#[test]
fn start_due_tasks_only_updates_due_not_started_tasks() {
    let db = open_test_database();
    for (id, planned_at_ms) in [("past", 1_000), ("boundary", 2_000), ("future", 3_000)] {
        TaskRepository::create(
            &db.connection,
            sample_create_input(id, id, planned_at_ms),
        )
        .expect("create task");
    }

    let started = TaskRepository::start_due_tasks(&db.connection, 2_000)
        .expect("start due tasks");

    assert_eq!(started, vec!["boundary".to_string(), "past".to_string()]);
    assert_eq!(
        TaskRepository::get_by_id(&db.connection, "past").unwrap().status,
        TaskStatus::InProgress,
    );
    assert_eq!(
        TaskRepository::get_by_id(&db.connection, "future").unwrap().status,
        TaskStatus::NotStarted,
    );
}

#[test]
fn start_due_tasks_is_idempotent_and_preserves_manual_states() {
    let db = open_test_database();
    for id in ["paused", "waiting", "completed", "cancelled"] {
        TaskRepository::create(
            &db.connection,
            sample_create_input(id, id, 1_000),
        )
        .expect("create task");
    }
    for (id, status) in [
        ("paused", TaskStatus::Paused),
        ("waiting", TaskStatus::Waiting),
        ("completed", TaskStatus::Completed),
        ("cancelled", TaskStatus::Cancelled),
    ] {
        TaskRepository::update(
            &db.connection,
            id,
            UpdateTaskInput {
                status: Some(status),
                updated_at_ms: 1_500,
                ..Default::default()
            },
        )
        .expect("set manual state");
    }

    assert!(TaskRepository::start_due_tasks(&db.connection, 2_000)
        .expect("first reconcile")
        .is_empty());
    assert!(TaskRepository::start_due_tasks(&db.connection, 3_000)
        .expect("second reconcile")
        .is_empty());
}
```

- [ ] **Step 2: Run the focused tests and verify failure**

Run:

```bash
cd src-tauri && cargo test db::repositories::task_repository::tests::start_due_tasks -- --nocapture
```

Expected: compilation fails because `TaskRepository::start_due_tasks` does not exist.

- [ ] **Step 3: Implement the conditional update**

Add this method to `impl TaskRepository`. Select the IDs first inside an unchecked transaction, update with the same predicate, then commit. Sorting makes the response deterministic for tests and UI handling.

```rust
pub fn start_due_tasks(
    connection: &Connection,
    now_ms: i64,
) -> Result<Vec<String>, TaskRepositoryError> {
    let transaction = connection.unchecked_transaction()?;
    let mut ids = {
        let mut statement = transaction.prepare(
            "SELECT id
             FROM tasks
             WHERE status = 'not_started'
               AND planned_at_ms <= ?1
             ORDER BY id ASC",
        )?;
        statement
            .query_map([now_ms], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?
    };

    if !ids.is_empty() {
        transaction.execute(
            "UPDATE tasks
             SET status = 'in_progress', updated_at_ms = ?1
             WHERE status = 'not_started'
               AND planned_at_ms <= ?1",
            [now_ms],
        )?;
    }
    transaction.commit()?;
    ids.sort();
    Ok(ids)
}
```

- [ ] **Step 4: Run repository tests**

Run:

```bash
cd src-tauri && cargo test db::repositories::task_repository::tests
```

Expected: all task repository tests pass.

- [ ] **Step 5: Commit the repository change**

```bash
git add src-tauri/src/db/repositories/task_repository.rs
git commit -m "feat: persist due task starts"
```

### Task 2: Return auto-start metadata from the Today query

**Files:**
- Modify: `src-tauri/src/services/task.rs`
- Modify: `src/services/tauri/tasks.ts`
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/DesignPreviewPage.tsx`
- Modify: `src/features/today/TodayTaskBoard.test.tsx`

- [ ] **Step 1: Add a failing service test**

Add a service test using the existing task test database helpers and local date helpers. Call `classify_today_tasks` only for classification tests; call the public query for reconciliation behavior.

```rust
#[test]
fn query_today_tasks_starts_due_tasks_and_reports_changed_ids() {
    let db = open_test_database();
    let due_at_ms = now_ms() - 60_000;
    TaskRepository::create(
        &db.connection,
        CreateTaskInput {
            id: "due-now".to_string(),
            title: "Due now".to_string(),
            note: None,
            planned_at_ms: due_at_ms,
            deadline_at_ms: Some(due_at_ms + 3_600_000),
            priority: Some(3),
            contact_id: None,
            contact_snapshot: None,
            created_at_ms: due_at_ms - 60_000,
            updated_at_ms: due_at_ms - 60_000,
        },
    )
    .expect("create due task");

    let first = TaskService::query_today_tasks(&db.connection).expect("first query");
    assert_eq!(first.auto_started_task_ids, vec!["due-now"]);
    assert_eq!(first.formal_tasks[0].status, TaskStatusDto::InProgress);

    let second = TaskService::query_today_tasks(&db.connection).expect("second query");
    assert!(second.auto_started_task_ids.is_empty());
}
```

- [ ] **Step 2: Run the focused service test and verify failure**

Run:

```bash
cd src-tauri && cargo test services::task::tests::query_today_tasks_starts_due_tasks -- --nocapture
```

Expected: compilation fails because `TodayTasksDto` has no `auto_started_task_ids`.

- [ ] **Step 3: Extend the DTO and coordinate before classification**

Add the event metadata field:

```rust
pub struct TodayTasksDto {
    pub formal_tasks: Vec<TaskDto>,
    pub upcoming_deadline_tasks: Vec<TaskDto>,
    pub overdue_tasks: Vec<TaskDto>,
    pub completed_today_tasks: Vec<TaskDto>,
    pub auto_started_task_ids: Vec<String>,
}
```

Change the public query to use one timestamp for both transition and classification:

```rust
pub fn query_today_tasks(connection: &Connection) -> Result<TodayTasksDto, AppError> {
    let as_of_ms = now_ms();
    let auto_started_task_ids =
        TaskRepository::start_due_tasks(connection, as_of_ms).map_err(map_task_error)?;
    let mut today = classify_today_tasks(connection, as_of_ms)?;
    today.auto_started_task_ids = auto_started_task_ids;
    Ok(today)
}
```

Initialize `auto_started_task_ids: Vec::new()` in `classify_today_tasks` so direct classification tests stay deterministic.

- [ ] **Step 4: Extend the TypeScript contract and fixtures**

Update the frontend type:

```ts
export type TodayTasks = {
  formalTasks: Task[];
  upcomingDeadlineTasks: Task[];
  overdueTasks: Task[];
  completedTodayTasks: Task[];
  autoStartedTaskIds: string[];
};
```

Add `autoStartedTaskIds: []` to `EMPTY_TODAY`, Design Preview data, and every typed Today fixture. Do not pass `TodayTasks[keyof TodayTasks]` as a task-list type after this field exists; Task 4 narrows it to `Task[]`.

- [ ] **Step 5: Run Rust and TypeScript contract checks**

Run:

```bash
cd src-tauri && cargo test services::task::tests::query_today_tasks_starts_due_tasks
npm run build
```

Expected: Rust test passes. TypeScript may still report the intentional `TodayTasks[keyof TodayTasks]` list-type error until Task 4; all other Today fixture errors must be fixed now.

- [ ] **Step 6: Commit the query contract**

```bash
git add src-tauri/src/services/task.rs src/services/tauri/tasks.ts src/pages/TodayPage.tsx src/pages/DesignPreviewPage.tsx src/features/today/TodayTaskBoard.test.tsx src/features/today/todayDisplay.test.ts
git commit -m "feat: report automatically started tasks"
```

### Task 3: Schedule the next planned start refresh

**Files:**
- Create: `src/features/today/useTaskAutoStart.ts`
- Create: `src/features/today/useTaskAutoStart.test.ts`
- Modify: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Write failing hook tests**

Create a helper fixture and verify nearest-time selection, callback timing, rescheduling, and cleanup.

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "../../services/tauri/tasks";
import { useTaskAutoStart } from "./useTaskAutoStart";

function task(id: string, plannedAtMs: number, status: Task["status"]): Task {
  return {
    id, title: id, plannedAtMs, priority: 2, status,
    createdAtMs: plannedAtMs - 1_000, updatedAtMs: plannedAtMs - 1_000,
  };
}

describe("useTaskAutoStart", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(10_000);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("refreshes once at the nearest future not-started task", () => {
    const refresh = vi.fn();
    renderHook(() => useTaskAutoStart([
      task("later", 15_000, "not_started"),
      task("next", 12_000, "not_started"),
      task("manual", 11_000, "paused"),
    ], refresh));

    act(() => vi.advanceTimersByTime(1_999));
    expect(refresh).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("clears the previous timer when task times change or the hook unmounts", () => {
    const refresh = vi.fn();
    const clearTimeoutSpy = vi.spyOn(window, "clearTimeout");
    const { rerender, unmount } = renderHook(
      ({ tasks }) => useTaskAutoStart(tasks, refresh),
      { initialProps: { tasks: [task("first", 12_000, "not_started")] } },
    );

    rerender({ tasks: [task("replacement", 14_000, "not_started")] });
    act(() => vi.advanceTimersByTime(2_000));
    expect(refresh).not.toHaveBeenCalled();
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the hook test and verify failure**

Run:

```bash
npm test -- src/features/today/useTaskAutoStart.test.ts
```

Expected: test suite fails because `useTaskAutoStart` does not exist.

- [ ] **Step 3: Implement the focused scheduler hook**

```ts
import { useEffect } from "react";
import type { Task } from "../../services/tauri/tasks";

const MAX_TIMEOUT_MS = 2_147_483_647;

export function useTaskAutoStart(tasks: Task[], refresh: () => void) {
  useEffect(() => {
    const now = Date.now();
    const nextStart = tasks
      .filter((task) => task.status === "not_started" && task.plannedAtMs > now)
      .reduce<number | null>(
        (nearest, task) => nearest == null ? task.plannedAtMs : Math.min(nearest, task.plannedAtMs),
        null,
      );
    if (nextStart == null) return;

    const timer = window.setTimeout(refresh, Math.min(nextStart - now, MAX_TIMEOUT_MS));
    return () => window.clearTimeout(timer);
  }, [refresh, tasks]);
}
```

- [ ] **Step 4: Install the scheduler in TodayPage**

Call it with formal tasks because those are the visible current-day tasks whose future start should update the current list:

```ts
useTaskAutoStart(todayTasks.formalTasks, () => void loadTodayTasks());
```

Keep `loadTodayTasks` memoized. Do not create a polling interval.

- [ ] **Step 5: Run hook tests and the build**

Run:

```bash
npm test -- src/features/today/useTaskAutoStart.test.ts
npm run build
```

Expected: hook tests and build pass after Task 4's list typing is applied; if executing strictly task-by-task, the only temporary build failure allowed is that already documented typing change.

- [ ] **Step 6: Commit the scheduler**

```bash
git add src/features/today/useTaskAutoStart.ts src/features/today/useTaskAutoStart.test.ts src/pages/TodayPage.tsx
git commit -m "feat: refresh tasks at planned start"
```

### Task 4: Add the stamp and workhorse broadcast

**Files:**
- Create: `src/features/today/TaskAutoStartBroadcast.tsx`
- Create: `src/features/today/TaskAutoStartBroadcast.css`
- Modify: `src/features/today/TodayTaskCard.tsx`
- Modify: `src/features/today/TodayTaskCard.css`
- Modify: `src/features/today/TodayTaskBoard.tsx`
- Modify: `src/features/today/TodayTaskBoard.test.tsx`
- Modify: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Write failing board interaction tests**

Extend the task fixture to accept a status and include `autoStartedTaskIds: []` in Today values. Add tests for the active stamp, live region, timer dismissal, manual dismissal, and ignored non-auto states.

```tsx
it("shows an active stamp and temporary workhorse broadcast for an auto-started task", () => {
  vi.useFakeTimers();
  const started = { ...task("started", "自动开工"), status: "in_progress" as const };
  render(<TodayTaskBoard tasks={{
    formalTasks: [started], upcomingDeadlineTasks: [], overdueTasks: [],
    completedTodayTasks: [], autoStartedTaskIds: [started.id],
  }} />);

  expect(screen.getByText("开工了")).toBeTruthy();
  expect(screen.getByText(/打工马播报：时间到了，活自己醒了/)).toBeTruthy();
  expect(screen.getByRole("status")).toBeTruthy();

  act(() => vi.advanceTimersByTime(4_000));
  expect(screen.queryByRole("status")).toBeNull();
  vi.useRealTimers();
});

it("does not broadcast a manual in-progress state", () => {
  const started = { ...task("manual", "人工开工"), status: "in_progress" as const };
  render(<TodayTaskBoard tasks={{
    formalTasks: [started], upcomingDeadlineTasks: [], overdueTasks: [],
    completedTodayTasks: [], autoStartedTaskIds: [],
  }} />);

  expect(screen.getByText("开工了")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
});
```

- [ ] **Step 2: Run the board test and verify failure**

Run:

```bash
npm test -- src/features/today/TodayTaskBoard.test.tsx
```

Expected: the stamp and workhorse broadcast assertions fail.

- [ ] **Step 3: Create the broadcast component**

Use the existing canonical workhorse asset through `Mascot` and keep the close control outside the task card's main button.

```tsx
import { useCallback, useEffect, useState } from "react";
import { Mascot } from "../../shared/ui";
import "./TaskAutoStartBroadcast.css";

const AUTO_DISMISS_MS = 4_000;

type TaskAutoStartBroadcastProps = { onDismiss: () => void };

export function TaskAutoStartBroadcast({ onDismiss }: TaskAutoStartBroadcastProps) {
  const [visible, setVisible] = useState(true);
  const dismiss = useCallback(() => {
    setVisible(false);
    onDismiss();
  }, [onDismiss]);
  useEffect(() => {
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [dismiss]);
  if (!visible) return null;

  return (
    <div className="task-auto-start-broadcast" role="status" aria-live="polite">
      <Mascot state="work-neutral" animation="breathe" size="sm" />
      <span>打工马播报：时间到了，活自己醒了。</span>
      <button type="button" onClick={dismiss} aria-label="收起开工播报">×</button>
    </div>
  );
}
```

- [ ] **Step 4: Add stable status stamps to formal cards**

Replace the formal-task status meta chip with a stamp whose semantic label remains the canonical state:

```tsx
<span
  className={`today-task-card__status-stamp today-task-card__status-stamp--${task.status}`}
  aria-label={`任务状态：${statusLabel(task.status)}`}
>
  {task.status === "in_progress" ? "开工了" : statusLabel(task.status)}
</span>
```

For announced cards render `<TaskAutoStartBroadcast />` as a sibling after `.today-task-card__button`, never nested inside it. Add a small `计划 HH:mm · 自动` label beside the active stamp only while the broadcast is present.

- [ ] **Step 5: Pass event metadata through the board and retain it in TodayPage**

Narrow `TodayTaskList.tasks` from `TodayTasks[keyof TodayTasks]` to `Task[]`. Add an `autoStartedTaskIds: Set<string>` parameter and pass `announceAutoStart={autoStartedTaskIds.has(task.id)}`.

In TodayPage, suppress catch-up events on first successful load and merge later event IDs until each broadcast calls its dismissal callback:

```ts
const hasLoadedTasks = useRef(false);
const [announcedTaskIds, setAnnouncedTaskIds] = useState<string[]>([]);

const next = await queryTodayTasks();
if (hasLoadedTasks.current && next.autoStartedTaskIds.length > 0) {
  setAnnouncedTaskIds((current) => [...new Set([...current, ...next.autoStartedTaskIds])]);
}
hasLoadedTasks.current = true;
setTodayTasks(next);
```

Pass the retained IDs and an `onBroadcastDismissed(id)` callback to `TodayTaskBoard`. The callback removes only that task ID.

- [ ] **Step 6: Implement the confirmed compact visual styling**

In `TodayTaskCard.css`:

- reserve right-side title space only on formal cards;
- position a rotated gray `not_started` stamp and lime `in_progress` stamp without covering the DDL;
- animate the active stamp once with a 180–220ms scale/rotation keyframe;
- give the broadcast a `min-height: 48px`, yellow signal background, 3px top border, 48px mascot, ellipsized desktop copy, and visible close target;
- on screens below 520px use “时间到了，自动开工。” through a dedicated short-copy span;
- in `prefers-reduced-motion: reduce`, remove stamp transforms and all transition/animation declarations.

- [ ] **Step 7: Run interaction tests and build**

Run:

```bash
npm test -- src/features/today/TodayTaskBoard.test.tsx src/features/today/useTaskAutoStart.test.ts
npm run build
```

Expected: all specified tests and the TypeScript/Vite build pass.

- [ ] **Step 8: Commit the Today card experience**

```bash
git add src/features/today/TaskAutoStartBroadcast.tsx src/features/today/TaskAutoStartBroadcast.css src/features/today/TodayTaskCard.tsx src/features/today/TodayTaskCard.css src/features/today/TodayTaskBoard.tsx src/features/today/TodayTaskBoard.test.tsx src/pages/TodayPage.tsx
git commit -m "feat: broadcast automatic task starts"
```

### Task 5: Full regression and visual verification

**Files:**
- Modify only files required by failures directly caused by this feature.

- [ ] **Step 1: Run frontend tests**

```bash
npm test
```

Expected: all Vitest suites pass.

- [ ] **Step 2: Run frontend production build**

```bash
npm run build
```

Expected: TypeScript and Vite build complete successfully.

- [ ] **Step 3: Run Rust tests**

```bash
cd src-tauri && cargo test
```

Expected: all Rust tests pass; existing unused-code warnings may remain, but no new error or failing test is allowed.

- [ ] **Step 4: Verify the live desktop flow**

Start the existing app with `npm run tauri -- dev`, create a task one to two minutes in the future, and verify:

1. Before the start time, the card has the muted “未开始” stamp.
2. At the planned minute, the persisted task changes to “进行中”.
3. The lime “开工了” stamp appears before the workhorse broadcast.
4. The yellow broadcast pushes card content rather than covering it and disappears after about four seconds.
5. Opening task details shows “进行中”.
6. A paused or waiting task does not auto-start.
7. Closing and reopening after a missed start corrects the state without replaying the old broadcast.

- [ ] **Step 5: Verify responsive and reduced-motion layouts**

Inspect the Today list at desktop width and 390px width. Confirm long titles, DDL, progress, stamp, mascot, short mobile copy, close button, focus ring, and reduced-motion behavior remain readable and non-overlapping.

- [ ] **Step 6: Commit any regression-only fixes**

If verification required scoped fixes:

```bash
git add src-tauri/src/db/repositories/task_repository.rs src-tauri/src/services/task.rs src/services/tauri/tasks.ts src/features/today/useTaskAutoStart.ts src/features/today/useTaskAutoStart.test.ts src/features/today/TaskAutoStartBroadcast.tsx src/features/today/TaskAutoStartBroadcast.css src/features/today/TodayTaskCard.tsx src/features/today/TodayTaskCard.css src/features/today/TodayTaskBoard.tsx src/features/today/TodayTaskBoard.test.tsx src/pages/TodayPage.tsx src/pages/DesignPreviewPage.tsx src/features/today/todayDisplay.test.ts
git commit -m "fix: polish automatic task start feedback"
```

If no fixes were needed, do not create an empty commit.
