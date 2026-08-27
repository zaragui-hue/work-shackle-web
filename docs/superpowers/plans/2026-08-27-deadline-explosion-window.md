# Deadline Explosion Window Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trigger a one-time always-on-top explosion window when an active task reaches its DDL, provide direct task actions, and consolidate overdue severity into the card’s progress marker.

**Architecture:** Extend the persisted Rust system-reminder kind with `DdlDue`, make the reminder engine fire only running-session deadlines, and reuse the existing reminder presenter/window. Route `ddl_due` payloads to a focused React explosion component whose action service calls existing task commands and notifies the main window. Keep card changes presentational by moving overdue tier copy into pure display helpers.

**Tech Stack:** Rust, rusqlite, Tauri 2, React 19, TypeScript, CSS, Vitest, Testing Library

---

## File map

- Modify `src-tauri/src/db/repositories/system_reminder_repository.rs`: add persisted `DdlDue` kind and deadline node.
- Modify `src-tauri/src/services/reminder_engine.rs`: fire `ddl_due` at runtime, skip startup catch-up, and avoid old-node catch-up after DDL.
- Modify `src-tauri/src/services/reminder_window.rs`: prioritize `ddl_due` and resize the specialized window.
- Modify `src/services/tauri/reminder.ts`: add task-changed event contract.
- Modify `src/features/reminder/reminderWindowCopy.ts`: add due copy fallback for shared helpers.
- Create `src/features/reminder/deadlineExplosionTime.ts`: convert a time-only selection into the next future timestamp.
- Create `src/features/reminder/deadlineExplosionTime.test.ts`: cover same-day and next-day time rules.
- Modify `src/features/reminder/reminderWindowActions.ts`: begin, postpone, complete, notify, focus, and hide actions.
- Create `src/features/reminder/DeadlineExplosionView.tsx`: explosion dialog UI and inline postpone editor.
- Create `src/features/reminder/DeadlineExplosionView.css`: fixed-window accident-ticket styling.
- Create `src/features/reminder/DeadlineExplosionView.test.tsx`: dialog, actions, time editor, and error behavior.
- Modify `src/features/reminder/ReminderWindowView.tsx`: route only `ddl_due` to the explosion component.
- Modify `src/features/reminder/ReminderWindowView.test.tsx`: verify routing and preserve existing reminder views.
- Modify `src/features/today/ddlProgressDisplay.ts`: expose merged overdue rail copy.
- Modify `src/features/today/ddlProgressDisplay.test.ts`: cover the three approved copy tiers.
- Modify `src/features/today/TodayTaskCard.tsx`: remove the separate chaos stamp and pass merged rail copy.
- Modify `src/features/today/DdlTimeProgress.tsx`: accept custom marker label and accessible name.
- Modify `src/features/today/DdlTimeProgress.css`: enlarge and recolor normal/overdue markers.
- Modify `src/features/today/TodayTaskCard.css`: remove obsolete stamp styling and tune responsive marker layout.
- Modify `src/features/today/TodayTaskBoard.test.tsx`: assert no duplicate severity and correct overdue rail copy.
- Modify `src/features/today/TodayTaskBoard.tsx`: no API change; retain existing deduplication.
- Modify `src/pages/TodayPage.tsx`: refresh the board after task changes from the reminder window.
- Modify `src/pages/DesignPreviewPage.tsx`: keep sample states visible for browser QA.

### Task 1: Add the persisted DDL-due reminder kind

**Files:**
- Modify: `src-tauri/src/db/repositories/system_reminder_repository.rs`

- [ ] **Step 1: Write failing repository tests**

Add assertions that `compute_nodes(0, 10_800_000)` includes exactly one `DdlDue` node at `10_800_000`, that `DdlDue.as_str()` is `ddl_due`, and that `from_str("ddl_due")` round-trips.

```rust
assert!(nodes.iter().any(|node| {
    node.kind == SystemReminderKind::DdlDue
        && node.trigger_at_ms == deadline_at_ms
}));
assert_eq!(SystemReminderKind::from_str("ddl_due"), Some(SystemReminderKind::DdlDue));
```

- [ ] **Step 2: Run the repository tests**

Run: `cd src-tauri && cargo test system_reminder_repository`

Expected: FAIL because `DdlDue` does not exist.

- [ ] **Step 3: Implement the kind and deadline node**

Add `DdlDue` to `SystemReminderKind`, `ALL`, string conversion, and urgency. Append `(SystemReminderKind::DdlDue, deadline_at_ms)` to candidates. Permit only this kind at `trigger_at_ms == deadline_at_ms`; keep all other kinds strictly inside the task range.

```rust
let is_deadline_node = kind == SystemReminderKind::DdlDue;
if trigger_at_ms <= planned_at_ms
    || trigger_at_ms > deadline_at_ms
    || (trigger_at_ms == deadline_at_ms && !is_deadline_node)
{
    continue;
}
```

- [ ] **Step 4: Run the repository tests again**

Run: `cd src-tauri && cargo test system_reminder_repository`

Expected: PASS.

- [ ] **Step 5: Commit the persisted reminder kind**

```bash
git add src-tauri/src/db/repositories/system_reminder_repository.rs
git commit -m "feat: add ddl due reminder kind"
```

### Task 2: Fire due reminders only during the active app session

**Files:**
- Modify: `src-tauri/src/services/reminder_engine.rs`
- Modify: `src-tauri/src/services/reminder_window.rs`

- [ ] **Step 1: Write failing engine tests**

Cover these cases with active, non-terminal tasks:

```rust
// deadline after startup cutoff and now reached => one ddl_due payload
assert!(matches!(result.triggered.as_slice(), [ReminderTriggeredPayload::System {
    reminder_kind, ..
}] if reminder_kind == "ddl_due"));

// deadline at or before startup cutoff => no popup
assert!(result.triggered.is_empty());

// tick after deadline => do not emit progress_half/quarter/one_hour
assert!(result.triggered.iter().all(|payload| matches!(payload,
    ReminderTriggeredPayload::System { reminder_kind, .. } if reminder_kind == "ddl_due"
)));
```

Also assert repeated ticks and a reopened database do not refire the same deadline snapshot. Update reminder-window ordering tests so `ddl_due` outranks every other payload.

- [ ] **Step 2: Run focused Rust tests**

Run: `cd src-tauri && cargo test reminder_engine && cargo test reminder_window`

Expected: FAIL because the engine skips every task at or after its deadline.

- [ ] **Step 3: Implement due selection**

For `now_ms >= deadline_snapshot_ms`, consider only `DdlDue`. Require `deadline_snapshot_ms > cutoff_ms` before marking it fired. For `now_ms < deadline_snapshot_ms`, retain the current most-urgent eligible pre-deadline behavior. Preserve the database uniqueness key `(task_id, kind, deadline_snapshot_ms)`.

- [ ] **Step 4: Resize due windows**

In `TauriReminderWindowPresenter::present`, set `520×560` for a primary `ddl_due` payload and `520×520` otherwise before showing and focusing the window.

- [ ] **Step 5: Run focused Rust tests again**

Run: `cd src-tauri && cargo test reminder_engine && cargo test reminder_window`

Expected: PASS.

- [ ] **Step 6: Commit runtime delivery**

```bash
git add src-tauri/src/services/reminder_engine.rs src-tauri/src/services/reminder_window.rs
git commit -m "feat: deliver deadline due reminders"
```

### Task 3: Add time-only postponement conversion

**Files:**
- Create: `src/features/reminder/deadlineExplosionTime.ts`
- Create: `src/features/reminder/deadlineExplosionTime.test.ts`

- [ ] **Step 1: Write failing time conversion tests**

```ts
expect(nextDeadlineFromClock("18:30", at("2026-08-27T17:00:00")))
  .toBe(at("2026-08-27T18:30:00"));
expect(nextDeadlineFromClock("09:00", at("2026-08-27T17:00:00")))
  .toBe(at("2026-08-28T09:00:00"));
expect(nextDeadlineFromClock("17:00", at("2026-08-27T17:00:00")))
  .toBe(at("2026-08-28T17:00:00"));
expect(() => nextDeadlineFromClock("25:00", Date.now())).toThrow();
```

- [ ] **Step 2: Run the helper test**

Run: `npm test -- src/features/reminder/deadlineExplosionTime.test.ts`

Expected: FAIL because the helper does not exist.

- [ ] **Step 3: Implement the helper**

Export `nextDeadlineFromClock(clock: string, nowMs = Date.now()): number` and `defaultExplosionPostponeClock(nowMs = Date.now()): string`. Parse `HH:mm`, reject invalid values, zero seconds/milliseconds, and add one calendar day when the selected result is not later than `nowMs`.

- [ ] **Step 4: Run the helper test again**

Run: `npm test -- src/features/reminder/deadlineExplosionTime.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit time conversion**

```bash
git add src/features/reminder/deadlineExplosionTime.ts src/features/reminder/deadlineExplosionTime.test.ts
git commit -m "feat: resolve explosion postpone times"
```

### Task 4: Add reminder-window task actions and refresh events

**Files:**
- Modify: `src/services/tauri/reminder.ts`
- Modify: `src/features/reminder/reminderWindowActions.ts`
- Create: `src/features/reminder/reminderWindowActions.test.ts`
- Modify: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Write failing action-service tests**

Mock task commands and Tauri window/event APIs. Assert:

```ts
await beginTaskFromReminderWindow("t1");
expect(updateTask).toHaveBeenCalledWith({ id: "t1", status: "in_progress" });
expect(emitTo).toHaveBeenCalledWith("main", REMINDER_OPEN_TASK_EVENT, { taskId: "t1" });

await postponeTaskFromReminderWindow("t1", nextDeadlineAtMs);
expect(postponeTask).toHaveBeenCalledWith({
  taskId: "t1",
  newDeadlineAtMs: nextDeadlineAtMs,
  reason: "到点爆炸弹窗延期",
});

await completeTaskFromReminderWindow("t1");
expect(completeTask).toHaveBeenCalledWith("t1");
```

All successful mutation actions emit `REMINDER_TASK_CHANGED_EVENT` to `main` and hide the reminder window. Rejected mutations do not hide it.

- [ ] **Step 2: Run the action tests**

Run: `npm test -- src/features/reminder/reminderWindowActions.test.ts`

Expected: FAIL because the new actions and event do not exist.

- [ ] **Step 3: Implement the action service**

Add `REMINDER_TASK_CHANGED_EVENT = "reminder://task-changed"`. Implement begin, postpone, and complete functions using `getTaskById`, `updateTask`, `postponeTask`, and `completeTask`. Reuse the existing main-window focus/open helper for `begin`.

- [ ] **Step 4: Refresh Today on reminder mutations**

In `TodayPage`, listen for `REMINDER_TASK_CHANGED_EVENT` and call `loadTodayTasks`; clean up the listener on unmount.

- [ ] **Step 5: Run action and Today tests**

Run: `npm test -- src/features/reminder/reminderWindowActions.test.ts src/features/today/TodayTaskBoard.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit reminder actions**

```bash
git add src/services/tauri/reminder.ts src/features/reminder/reminderWindowActions.ts src/features/reminder/reminderWindowActions.test.ts src/pages/TodayPage.tsx
git commit -m "feat: handle tasks from reminder window"
```

### Task 5: Build the explosion dialog

**Files:**
- Create: `src/features/reminder/DeadlineExplosionView.tsx`
- Create: `src/features/reminder/DeadlineExplosionView.css`
- Create: `src/features/reminder/DeadlineExplosionView.test.tsx`
- Modify: `src/features/reminder/ReminderWindowView.tsx`
- Modify: `src/features/reminder/ReminderWindowView.test.tsx`
- Modify: `src/features/reminder/reminderWindowCopy.ts`
- Modify: `src/config/copy.ts`

- [ ] **Step 1: Write failing dialog tests**

Render a `ddl_due` payload and assert:

```ts
expect(screen.getByRole("dialog", { name: /提交方案/ })).toBeTruthy();
expect(screen.getByText("到点爆炸")).toBeTruthy();
expect(screen.getByRole("button", { name: "现在处理" })).toBeTruthy();
expect(screen.getByRole("button", { name: "延期" })).toBeTruthy();
expect(screen.getByRole("button", { name: "结束任务" })).toBeTruthy();
```

Click `延期`, assert a labelled `input[type="time"]` appears with the one-hour default, select a value, and assert confirm calls the postponement action with the converted timestamp. Mock a rejected action and assert the dialog remains visible with `role="alert"`.

Update `ReminderWindowView.test.tsx` so `ddl_due` renders the new component while `one_hour_remaining`, progress, and custom payloads retain the existing ticket.

- [ ] **Step 2: Run dialog tests**

Run: `npm test -- src/features/reminder/DeadlineExplosionView.test.tsx src/features/reminder/ReminderWindowView.test.tsx`

Expected: FAIL because the explosion component does not exist.

- [ ] **Step 3: Implement the component**

Create a focused component with local state:

```ts
type ExplosionAction = "begin" | "postpone" | "complete" | null;
const [postponeOpen, setPostponeOpen] = useState(false);
const [clock, setClock] = useState(() => defaultExplosionPostponeClock());
const [busyAction, setBusyAction] = useState<ExplosionAction>(null);
const [error, setError] = useState<string | null>(null);
```

Map caught task errors through `mapTaskError`, keep the dialog open on failure, and disable actions only while one mutation is active. Render the original DDL with `date-fns` `HH:mm` formatting.

- [ ] **Step 4: Route `ddl_due` payloads**

At the top of `ReminderWindowView`, return `DeadlineExplosionView` when `primary.kind === "system" && primary.reminderKind === "ddl_due"`; do not alter other reminder markup.

- [ ] **Step 5: Apply fixed-window styling**

Use the approved palette and hierarchy: cream paper, ink border, one red explosion field, yellow deadline/time input, and blue confirm action. Keep the dialog within 520×560, wrap long task names, add visible focus, use one 600ms entrance jolt, and disable it under reduced motion.

- [ ] **Step 6: Run dialog tests again**

Run: `npm test -- src/features/reminder/DeadlineExplosionView.test.tsx src/features/reminder/ReminderWindowView.test.tsx`

Expected: PASS.

- [ ] **Step 7: Commit the explosion dialog**

```bash
git add src/config/copy.ts src/features/reminder/DeadlineExplosionView.tsx src/features/reminder/DeadlineExplosionView.css src/features/reminder/DeadlineExplosionView.test.tsx src/features/reminder/ReminderWindowView.tsx src/features/reminder/ReminderWindowView.test.tsx src/features/reminder/reminderWindowCopy.ts
git commit -m "feat: add deadline explosion dialog"
```

### Task 6: Merge overdue severity into the rail marker

**Files:**
- Modify: `src/features/today/ddlProgressDisplay.ts`
- Modify: `src/features/today/ddlProgressDisplay.test.ts`
- Modify: `src/features/today/TodayTaskCard.tsx`
- Modify: `src/features/today/DdlTimeProgress.tsx`
- Modify: `src/features/today/DdlTimeProgress.css`
- Modify: `src/features/today/TodayTaskCard.css`
- Modify: `src/features/today/TodayTaskBoard.test.tsx`

- [ ] **Step 1: Write failing display tests**

Add `overdueRailStatus(deadlineAtMs, nowMs)` tests for the exact approved labels:

```ts
expect(overdueRailStatus(now - 12 * HOUR_MS, now)).toEqual({
  label: "尸体还热，赶紧抢救",
  duration: "超时 12 小时",
});
expect(overdueRailStatus(now - 48 * HOUR_MS, now).label).toBe("已经烂透，优先处理");
expect(overdueRailStatus(now - 96 * HOUR_MS, now).label).toBe("永久工位，爱咋咋地");
```

Update board tests to assert the standalone `aria-label="逾期状态：…"` is absent and the marker exposes the combined accessible label.

- [ ] **Step 2: Run display tests**

Run: `npm test -- src/features/today/ddlProgressDisplay.test.ts src/features/today/TodayTaskBoard.test.tsx`

Expected: FAIL because the rail helper and marker override do not exist.

- [ ] **Step 3: Implement merged marker content**

Add optional `markerLabel`, `markerValue`, and `markerAriaLabel` props to `DdlTimeProgress`. For overdue cards, compute `overdueRailStatus`, remove `OverdueChaosStamp`, and pass the merged label/value to the forced-full track marker.

- [ ] **Step 4: Tune marker styling**

Increase marker label/value sizes, use ink background with light text and one blue shadow for normal tasks, and red with ink shadow for overdue tasks. Delete obsolete chaos-stamp CSS. On narrow screens hide only the normal `距离爆炸` label; retain the overdue severity phrase with truncation.

- [ ] **Step 5: Run display tests again**

Run: `npm test -- src/features/today/ddlProgressDisplay.test.ts src/features/today/TodayTaskBoard.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit merged rail status**

```bash
git add src/features/today/ddlProgressDisplay.ts src/features/today/ddlProgressDisplay.test.ts src/features/today/DdlTimeProgress.tsx src/features/today/DdlTimeProgress.css src/features/today/TodayTaskCard.tsx src/features/today/TodayTaskCard.css src/features/today/TodayTaskBoard.test.tsx
git commit -m "feat: merge overdue status into time rail"
```

### Task 7: Full regression and visual verification

**Files:**
- Modify: `src/pages/DesignPreviewPage.tsx`
- Verify: all files above

- [ ] **Step 1: Add preview fixtures**

Ensure the preview includes normal progress and all three overdue durations. Add a development-only reminder-window preview query for `ddl_due` or render `DeadlineExplosionView` through an existing preview entry without invoking Tauri actions.

- [ ] **Step 2: Run all checks**

Run: `npm test`

Expected: every Vitest test passes.

Run: `npm run build`

Expected: TypeScript and Vite build pass.

Run: `cd src-tauri && cargo test`

Expected: every Rust test passes.

- [ ] **Step 3: Inspect the explosion window**

Open its preview at 520×560. Verify long title wrapping, red/yellow/ink balance, all three actions, the expanded time editor, failure alert placement, keyboard focus, and reduced-motion behavior.

- [ ] **Step 4: Inspect Today at desktop and 390px**

Verify the normal marker is readable, all three overdue markers use approved copy, no standalone chaos stamp remains, rails do not overflow, and mobile controls do not collide.

- [ ] **Step 5: Commit preview and QA adjustments**

```bash
git add src/pages/DesignPreviewPage.tsx docs/superpowers/plans/2026-08-27-deadline-explosion-window.md
git commit -m "test: verify deadline explosion experience"
```

Expected: one implementation commit containing reminder delivery, dialog actions, card status consolidation, tests, and preview fixtures.
