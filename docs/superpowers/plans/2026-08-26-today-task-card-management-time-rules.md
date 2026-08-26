# Today Task Card Management and Time Rules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make task date and minute selection explicit, prevent past starts, lock time after work begins, and move task status management from the drawer into today task cards.

**Architecture:** Keep the existing local datetime string contract while introducing a split date/time field and pure minute helpers. Keep task cards presentational by passing status-change callbacks from `TodayPage`, and centralize terminal-status routing so completed and cancelled tasks always use their timestamp-aware commands. Enforce started-task time locking in both the drawer and Rust update validation.

**Tech Stack:** React 19, React Hook Form, Zod, TypeScript, Vitest, Testing Library, Tauri 2, Rust, rusqlite.

---

## File Structure

- Create `src/features/tasks/taskDateTime.ts`: local-minute formatting, rounding, comparison, and split/combine helpers.
- Create `src/features/tasks/TaskDateTimeField.tsx`: accessible paired date and time controls backed by one local datetime string.
- Create `src/features/tasks/TaskDateTimeField.css`: compact two-column field layout with mobile fallback.
- Create `src/features/tasks/taskStatusActions.ts`: route ordinary, completed, and cancelled status changes to the correct task service.
- Create `src/features/tasks/taskStatusActions.test.ts`: verify terminal status routing.
- Modify `src/features/tasks/createTaskForm.ts`: round defaults forward and reject past starts.
- Modify `src/features/tasks/taskDrawerForm.ts`: keep status for validation, omit status from core autosave, and omit locked time fields.
- Modify `src/features/tasks/TaskCoreFields.tsx`: render shared split date/time controls and support independent time locking.
- Modify `src/features/tasks/CreateTaskDrawer.tsx`: supply React Hook Form control and current-minute lower bound.
- Modify `src/features/tasks/TaskDrawer.tsx`: lock time after start and remove the drawer management module and success marker.
- Modify `src/features/tasks/PostponeTaskModal.tsx`: collect an explicit new completion date and time.
- Modify `src/features/today/TodayTaskCard.tsx`: add the compact card management strip outside the card-open button.
- Modify `src/features/today/TodayTaskBoard.tsx`: pass status callbacks and busy state to each card.
- Modify `src/pages/TodayPage.tsx`: execute confirmed status transitions, refresh tasks, and retain action errors.
- Modify associated CSS and tests for the new layout and interaction.
- Modify `src-tauri/src/services/task.rs` and `src-tauri/src/commands/task.rs`: validate current-minute creation at the IPC boundary and reject direct time edits after start.

### Task 1: Local-Minute Model and Split Date/Time Field

**Files:**
- Create: `src/features/tasks/taskDateTime.ts`
- Create: `src/features/tasks/TaskDateTimeField.tsx`
- Create: `src/features/tasks/TaskDateTimeField.css`
- Create: `src/features/tasks/TaskDateTimeField.test.tsx`

- [ ] **Step 1: Write failing helper and component tests**

```tsx
it("rounds a time with seconds up to the next selectable minute", () => {
  expect(currentMinuteValue(new Date(2026, 7, 26, 9, 17, 43)))
    .toBe("2026-08-26T09:18");
});

it("combines independently selected date and minute values", () => {
  const onChange = vi.fn();
  render(<TaskDateTimeField label="开始时间" value="2026-08-26T09:18" onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("开始时间 日期"), { target: { value: "2026-08-27" } });
  expect(onChange).toHaveBeenLastCalledWith("2026-08-27T09:18");
  fireEvent.change(screen.getByLabelText("开始时间 时分"), { target: { value: "10:25" } });
  expect(onChange).toHaveBeenLastCalledWith("2026-08-26T10:25");
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/features/tasks/TaskDateTimeField.test.tsx`

Expected: FAIL because the helper and component do not exist.

- [ ] **Step 3: Implement minute helpers and the paired field**

```ts
export function currentMinuteValue(now = new Date()): string {
  const rounded = new Date(now);
  if (rounded.getSeconds() > 0 || rounded.getMilliseconds() > 0) {
    rounded.setMinutes(rounded.getMinutes() + 1);
  }
  rounded.setSeconds(0, 0);
  return format(rounded, "yyyy-MM-dd'T'HH:mm");
}

export function splitDateTime(value: string) {
  const [date = "", time = ""] = value.split("T");
  return { date, time };
}

export function combineDateTime(date: string, time: string) {
  return date && time ? `${date}T${time}` : "";
}
```

`TaskDateTimeField` renders a visible group label plus inputs labelled `${label} 日期` and `${label} 时分`. It applies `minDate` to the date input and only applies `minTime` when the selected date equals the minimum date.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/features/tasks/TaskDateTimeField.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the field implementation**

```bash
git add src/features/tasks/taskDateTime.ts src/features/tasks/TaskDateTimeField.tsx src/features/tasks/TaskDateTimeField.css src/features/tasks/TaskDateTimeField.test.tsx
git commit -m "feat: add explicit task date and time fields"
```

### Task 2: Form Bounds and Started-Task Time Locking

**Files:**
- Modify: `src/features/tasks/createTaskForm.ts`
- Modify: `src/features/tasks/createTaskForm.test.ts`
- Modify: `src/features/tasks/taskDrawerForm.ts`
- Modify: `src/features/tasks/taskDrawerForm.test.ts`
- Modify: `src/features/tasks/TaskCoreFields.tsx`
- Modify: `src/features/tasks/TaskCoreFields.css`
- Modify: `src/features/tasks/CreateTaskDrawer.tsx`

- [ ] **Step 1: Add failing form tests**

```ts
it("defaults to the next selectable minute", () => {
  vi.setSystemTime(new Date(2026, 7, 26, 9, 17, 43));
  expect(createDefaultFormValues().startAt).toBe("2026-08-26T09:18");
});

it("rejects a start before the current selectable minute", () => {
  vi.setSystemTime(new Date(2026, 7, 26, 9, 17, 43));
  const result = createTaskFormSchema.safeParse({
    ...createDefaultFormValues(),
    title: "交方案",
    startAt: "2026-08-26T09:17",
  });
  expect(result.error?.issues.some((issue) => issue.message === "开始时间不能早于当前时间")).toBe(true);
});

it("omits time and status from autosave after the task has started", () => {
  expect(toUpdateTaskInput(detail.task, taskDetailToFormValues(detail))).not.toHaveProperty("plannedAtMs");
  expect(toUpdateTaskInput(detail.task, taskDetailToFormValues(detail))).not.toHaveProperty("deadlineAtMs");
  expect(toUpdateTaskInput(detail.task, taskDetailToFormValues(detail))).not.toHaveProperty("status");
});
```

- [ ] **Step 2: Run form tests and verify they fail**

Run: `npm test -- src/features/tasks/createTaskForm.test.ts src/features/tasks/taskDrawerForm.test.ts`

Expected: FAIL on minute rounding, past validation, and locked update fields.

- [ ] **Step 3: Implement dynamic past-start validation and conditional update mapping**

Use `currentMinuteValue()` for the default. In both form schemas, add a `startAt` issue when the status is new/not-started and its milliseconds are before the current selectable minute. In `toUpdateTaskInput`, include `plannedAtMs` and `deadlineAtMs` only when `task.status === "not_started"`, and never include `status`.

- [ ] **Step 4: Replace native datetime-local fields with Controllers**

`TaskCoreFields` receives `control`, `timeDisabled`, and `minStartAt`. It uses `Controller` for `startAt` and `endAt`, passes `minStartAt` to the start field, and passes one minute after `startAt` to the completion field. Other fields retain the existing `register` behavior.

- [ ] **Step 5: Run form and create drawer tests**

Run: `npm test -- src/features/tasks/createTaskForm.test.ts src/features/tasks/taskDrawerForm.test.ts src/features/tasks/CreateTaskDrawer.test.tsx`

Expected: PASS with assertions for separate date and time inputs.

- [ ] **Step 6: Commit form integration**

```bash
git add src/features/tasks/createTaskForm.ts src/features/tasks/createTaskForm.test.ts src/features/tasks/taskDrawerForm.ts src/features/tasks/taskDrawerForm.test.ts src/features/tasks/TaskCoreFields.tsx src/features/tasks/TaskCoreFields.css src/features/tasks/CreateTaskDrawer.tsx src/features/tasks/CreateTaskDrawer.test.tsx
git commit -m "feat: enforce task time selection rules"
```

### Task 3: Drawer Cleanup and Explicit Completion-Time Postponement

**Files:**
- Modify: `src/features/tasks/TaskDrawer.tsx`
- Modify: `src/features/tasks/TaskDrawer.css`
- Modify: `src/features/tasks/TaskDrawer.test.tsx`
- Modify: `src/features/tasks/PostponeTaskModal.tsx`
- Modify: `src/features/tasks/PostponeTaskModal.css`
- Create: `src/features/tasks/PostponeTaskModal.test.tsx`

- [ ] **Step 1: Add failing drawer and postponement tests**

```tsx
expect(screen.queryByText("任务管理")).toBeNull();
expect(screen.queryByLabelText("主状态")).toBeNull();
expect(screen.queryByText("情报已同步")).toBeNull();

expect(screen.getByLabelText("开始时间 日期")).toBeDisabled();
expect(screen.getByLabelText("完成时间 时分")).toBeDisabled();
expect(screen.getByRole("button", { name: "申请延期" })).toBeTruthy();

expect(screen.getByLabelText("新完成时间 日期")).toBeTruthy();
expect(screen.getByLabelText("新完成时间 时分")).toBeTruthy();
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- src/features/tasks/TaskDrawer.test.tsx src/features/tasks/PostponeTaskModal.test.tsx`

Expected: FAIL because the drawer still contains management and native datetime controls.

- [ ] **Step 3: Remove management UI and silent-success feedback**

Delete the drawer management section, progress calculations, main-status select, and visible saving/saved paragraphs. Keep save errors and `saveStatus` for request serialization and action disabling.

- [ ] **Step 4: Lock time and update postponement UI**

Pass `timeDisabled={terminal || detail.task.status !== "not_started"}`. Show “申请延期” only for started nonterminal tasks with a completion time. Convert the postponement form to `Controller` + `TaskDateTimeField`, label it “新完成时间”, and retain current-deadline and reason validation.

- [ ] **Step 5: Run drawer and postponement tests**

Run: `npm test -- src/features/tasks/TaskDrawer.test.tsx src/features/tasks/PostponeTaskModal.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit drawer changes**

```bash
git add src/features/tasks/TaskDrawer.tsx src/features/tasks/TaskDrawer.css src/features/tasks/TaskDrawer.test.tsx src/features/tasks/PostponeTaskModal.tsx src/features/tasks/PostponeTaskModal.css src/features/tasks/PostponeTaskModal.test.tsx
git commit -m "feat: lock started task timing behind postponement"
```

### Task 4: Card-Embedded Task Management and Terminal Status Routing

**Files:**
- Create: `src/features/tasks/taskStatusActions.ts`
- Create: `src/features/tasks/taskStatusActions.test.ts`
- Modify: `src/features/today/TodayTaskCard.tsx`
- Modify: `src/features/today/TodayTaskCard.css`
- Modify: `src/features/today/TodayTaskBoard.tsx`
- Modify: `src/features/today/TodayTaskBoard.test.tsx`
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/TodayPage.css`

- [ ] **Step 1: Add failing status routing tests**

```ts
await changeTaskStatus("task-1", "paused");
expect(updateTask).toHaveBeenCalledWith({ id: "task-1", status: "paused" });

await changeTaskStatus("task-1", "completed");
expect(completeTask).toHaveBeenCalledWith("task-1");

await changeTaskStatus("task-1", "cancelled");
expect(cancelTask).toHaveBeenCalledWith("task-1");
```

- [ ] **Step 2: Add failing task-card interaction tests**

Render a formal task, change `${task.title} 主状态` to “暂停”, and assert the status callback receives `(task, "paused")` while the card-open callback is not called. Render a completed task and assert it shows a read-only “已完成” status label.

- [ ] **Step 3: Run focused tests and verify they fail**

Run: `npm test -- src/features/tasks/taskStatusActions.test.ts src/features/today/TodayTaskBoard.test.tsx`

Expected: FAIL because the routing helper and card manager do not exist.

- [ ] **Step 4: Implement terminal routing and management strip**

```ts
export function changeTaskStatus(id: string, status: TaskStatus) {
  if (status === "completed") return completeTask(id);
  if (status === "cancelled") return cancelTask(id);
  return updateTask({ id, status });
}
```

Place the management strip after the card-open button. Nonterminal cards render a compact labelled select; terminal cards render a status stamp. For tasks that have started, omit the `not_started` option so users cannot reopen time editing by reversing status.

- [ ] **Step 5: Wire the page interaction**

`TodayPage` tracks the busy task ID and a separate action error. It confirms cancellation, calls `changeTaskStatus`, refreshes today tasks on success, and leaves the task list visible with an error message on failure.

- [ ] **Step 6: Run card tests**

Run: `npm test -- src/features/tasks/taskStatusActions.test.ts src/features/today/TodayTaskBoard.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit card management**

```bash
git add src/features/tasks/taskStatusActions.ts src/features/tasks/taskStatusActions.test.ts src/features/today/TodayTaskCard.tsx src/features/today/TodayTaskCard.css src/features/today/TodayTaskBoard.tsx src/features/today/TodayTaskBoard.test.tsx src/pages/TodayPage.tsx src/pages/TodayPage.css
git commit -m "feat: move task status management into today cards"
```

### Task 5: Backend Time Guards

**Files:**
- Modify: `src-tauri/src/services/task.rs`
- Modify: `src-tauri/src/commands/task.rs`

- [ ] **Step 1: Add failing Rust validation tests**

```rust
#[test]
fn planned_start_must_not_precede_current_minute() {
    assert!(validate_planned_start(120_000, 179_999).is_err());
    assert!(validate_planned_start(180_000, 179_999).is_ok());
}

#[test]
fn started_task_rejects_direct_time_edits() {
    let existing = task_with_status(TaskStatus::InProgress);
    let input = UpdateTaskRequest { planned_at_ms: Some(2_000), ..Default::default() };
    assert!(validate_update_request(&existing, &input).is_err());
}
```

- [ ] **Step 2: Run Rust task tests and verify they fail**

Run: `cargo test services::task --manifest-path src-tauri/Cargo.toml`

Expected: FAIL because current-minute and started-task guards are absent.

- [ ] **Step 3: Implement guards without disturbing test fixture creation**

Add a pure `validate_planned_start(planned_at_ms, now_ms)` helper and call it from the Tauri `create_task` command before `TaskService::create`. Extend `validate_update_request` to reject `planned_at_ms` or `deadline_at_ms` when the existing task status is not `NotStarted`. The postponement service continues updating the repository directly after its own validation.

- [ ] **Step 4: Run Rust task tests**

Run: `cargo test services::task --manifest-path src-tauri/Cargo.toml`

Expected: PASS.

- [ ] **Step 5: Commit backend guards**

```bash
git add src-tauri/src/services/task.rs src-tauri/src/commands/task.rs
git commit -m "fix: enforce task timing rules in backend"
```

### Task 6: Full Verification and Visual QA

**Files:**
- Modify only if verification exposes a scoped defect.

- [ ] **Step 1: Run all frontend tests**

Run: `npm test`

Expected: all Vitest suites pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript compilation and Vite production build succeed.

- [ ] **Step 3: Run all Rust tests**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: all Rust tests pass.

- [ ] **Step 4: Inspect the rendered workflow**

Verify at desktop and narrow widths that date and time inputs remain readable, status controls do not trigger the drawer, task cards remain compact, started task time fields are disabled, and the postponement dialog names the new completion time clearly.

- [ ] **Step 5: Check the final diff**

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 6: Re-run affected checks after any verification fix**

If a scoped defect is found, update the responsible task files listed above, re-run its focused test, then repeat Steps 1–5 before handing off the result.
