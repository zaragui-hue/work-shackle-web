# Workstation Alarm Time Ranges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace point-in-time workstation reminders with non-overlapping time ranges that automatically drive work-status changes, recover to focus mode, and defer prepare-to-leave mode while a range is active.

**Architecture:** Keep reminder data in localStorage, upgrade it to a v2 range model, and centralize validation, migration, sorting, and active-range calculation in pure functions. The reminder hook owns persisted editing state and current range; the status automation hook translates that range plus the work schedule into status transitions. The editor renders autosaving draft cards with compact clock selectors, while settings and reminder content share one status-filter policy.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Tauri IPC, CSS.

---

## File map

- Create `src/features/today/workStatusOptions.ts`: shared status filtering for manual picker, reminders, and settings.
- Modify `src/features/today/workdayReminders.ts`: v2 model, migration, validation, sorting, range lookup, defaults.
- Modify `src/features/today/workdayReminders.test.ts`: pure-logic and migration coverage.
- Modify `src/features/today/useWorkdayReminders.ts`: autosave edits, errors, drafts, active-range calculation.
- Create `src/features/today/useWorkdayReminders.test.ts`: hook lifecycle and storage coverage.
- Modify `src/features/today/WorkScheduleEditor.tsx`: range cards, four clock selectors, content picker, error UI.
- Modify `src/features/today/WorkScheduleEditor.css`: range editor layout.
- Modify `src/features/today/WorkScheduleEditor.test.tsx`: add/edit/sort/conflict interaction coverage.
- Modify `src/features/today/useWorkdayStatusAutomation.ts`: range entry/exit and prepare-to-leave transitions.
- Modify `src/features/today/useWorkdayStatusAutomation.test.tsx`: status transition coverage.
- Modify `src/pages/TodayPage.tsx`: pass the effective schedule into reminder management and automation.
- Modify `src/features/today/WorkStatusPanel.tsx`: consume shared manual-picker filter.
- Modify `src/features/settings/StatusCopySection.tsx`: hide only `working` and retain automatic statuses.
- Create `src/features/settings/StatusCopySection.test.tsx`: settings filter regression coverage.

### Task 1: Centralize status visibility rules

**Files:**
- Create: `src/features/today/workStatusOptions.ts`
- Modify: `src/features/today/WorkStatusPanel.tsx`
- Modify: `src/features/settings/StatusCopySection.tsx`
- Test: `src/features/settings/StatusCopySection.test.tsx`

- [ ] **Step 1: Write failing filter tests**

Cover these contracts:

```ts
expect(isManualWorkStatus("working")).toBe(false);
expect(isReminderWorkStatus("focus_brick")).toBe(false);
expect(isReminderWorkStatus("preparing_leave")).toBe(false);
expect(isSettingsWorkStatus("focus_brick")).toBe(true);
expect(isSettingsWorkStatus("preparing_leave")).toBe(true);
expect(isSettingsWorkStatus("working")).toBe(false);
```

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run src/features/settings/StatusCopySection.test.tsx`
Expected: FAIL because shared filters do not exist and settings still requests `working` copies.

- [ ] **Step 3: Implement shared predicates and apply them**

```ts
export const AUTOMATIC_FOCUS_STATUS = "focus_brick";
export const AUTOMATIC_PREPARE_STATUS = "preparing_leave";
export const HIDDEN_WORKING_STATUS = "working";

export function isManualWorkStatus(statusType: string) {
  return statusType !== HIDDEN_WORKING_STATUS;
}

export function isReminderWorkStatus(statusType: string) {
  return isManualWorkStatus(statusType)
    && statusType !== AUTOMATIC_FOCUS_STATUS
    && statusType !== AUTOMATIC_PREPARE_STATUS;
}

export const isSettingsWorkStatus = isManualWorkStatus;
```

Use these predicates in the current-status picker, reminder choices, and status-copy loader.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run src/features/settings/StatusCopySection.test.tsx src/features/today/todayMascotPlaceholders.test.tsx`
Expected: PASS.

### Task 2: Build the v2 range model and migration

**Files:**
- Modify: `src/features/today/workdayReminders.ts`
- Modify: `src/features/today/workdayReminders.test.ts`

- [ ] **Step 1: Write failing pure-function tests**

Test the v2 type and these functions:

```ts
sortWorkdayReminders(reminders);
validateWorkdayReminder(candidate, reminders, schedule);
findActiveWorkdayReminder({ reminders, workDate, nowMs });
createWorkdayReminder(nowMs);
loadWorkdayReminders(storage, schedule);
```

Assertions must cover next-whole-hour defaults, 30-minute duration, start-before-end, schedule bounds, overlap rejection, touching ranges, stable order, current-range lookup, v1 migration, and exclusion of `working`/`preparing_leave`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run src/features/today/workdayReminders.test.ts`
Expected: FAIL against the point-reminder model.

- [ ] **Step 3: Implement the v2 model**

```ts
export type WorkdayReminder = {
  id: string;
  startTime: string;
  endTime: string;
  statusType: string | null;
  enabled: boolean;
  createdAtMs: number;
};
```

Use `work-shackle.workday-reminders.v2`, read v1 only when v2 is absent, migrate valid statuses to 30-minute ranges, disable overlapping/out-of-schedule migrated rows, and write normalized v2 data. Represent validation failures as stable user-facing messages.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run src/features/today/workdayReminders.test.ts`
Expected: PASS.

### Task 3: Add autosaving reminder state and active-range calculation

**Files:**
- Modify: `src/features/today/useWorkdayReminders.ts`
- Create: `src/features/today/useWorkdayReminders.test.ts`

- [ ] **Step 1: Write failing hook tests**

Cover adding a disabled draft, auto-enabling after a valid content selection, rejecting conflicts without overwriting the prior row, stable sorted state, persistence failure rollback, and active-range changes as the clock advances.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run src/features/today/useWorkdayReminders.test.ts`
Expected: FAIL because the manager lacks range-aware errors and update results.

- [ ] **Step 3: Implement the manager contract**

Expose:

```ts
type WorkdayReminderManager = {
  reminders: WorkdayReminder[];
  activeReminder: WorkdayReminder | null;
  errors: Record<string, string | null>;
  expandedId: string | null;
  addReminder(): void;
  updateReminder(id: string, patch: Partial<WorkdayReminder>): void;
  removeReminder(id: string): void;
  setExpandedId(id: string | null): void;
};
```

Recalculate activity every 15 seconds and immediately after edits. Roll back invalid or failed persisted changes; drafts may hold incomplete content while disabled.

- [ ] **Step 4: Run hook tests**

Run: `npm test -- --run src/features/today/useWorkdayReminders.test.ts`
Expected: PASS.

### Task 4: Replace the editor with autosaving range cards

**Files:**
- Modify: `src/features/today/WorkScheduleEditor.tsx`
- Modify: `src/features/today/WorkScheduleEditor.css`
- Modify: `src/features/today/WorkScheduleEditor.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Verify “+ 添加” opens a disabled draft, four compact clock selectors are present, content has no `working`/`focus_brick`/`preparing_leave` options, content selection auto-enables, summaries show `HH:mm–HH:mm`, list order updates, and conflicts display without a save button.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx`
Expected: FAIL against the point-reminder editor.

- [ ] **Step 3: Implement the range-card UI**

Extract a focused `WorkReminderRangeEditor` inside the feature folder if the parent becomes difficult to scan. Reuse `CompactClockSelect` for each hour/minute field, derive option labels from work statuses, and bind every selection directly to `updateReminder`.

- [ ] **Step 4: Add responsive styles**

Use a two-column start/end time grid on normal widths and a single column below 420px. Keep inline error text associated with its card and preserve the existing console visual language.

- [ ] **Step 5: Run editor tests**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx`
Expected: PASS.

### Task 5: Drive status automation from active ranges

**Files:**
- Modify: `src/features/today/useWorkdayStatusAutomation.ts`
- Modify: `src/features/today/useWorkdayStatusAutomation.test.tsx`
- Modify: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Write failing automation tests**

Test entry into a meeting range, content changes, exit to `focus_brick`, exit after the prepare threshold to `preparing_leave`, deferment while a range is active, application startup inside a range, and no new switch after work end.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- --run src/features/today/useWorkdayStatusAutomation.test.tsx`
Expected: FAIL because automation currently treats reminders as one-shot prompts.

- [ ] **Step 3: Implement phase-based transitions**

Pass the effective `WorkSchedule` into reminder management and automation. Compare the active reminder ID/status and computed fallback target with the previous automation target; call `switchStatus` only when the desired target changes. Preserve the existing retry notice on IPC failure.

- [ ] **Step 4: Run automation tests**

Run: `npm test -- --run src/features/today/useWorkdayStatusAutomation.test.tsx`
Expected: PASS.

### Task 6: Full verification

**Files:**
- Verify all files above.

- [ ] **Step 1: Run the relevant frontend suite**

Run: `npm test -- --run src/features/today/workdayReminders.test.ts src/features/today/useWorkdayReminders.test.ts src/features/today/WorkScheduleEditor.test.tsx src/features/today/useWorkdayStatusAutomation.test.tsx src/features/settings/StatusCopySection.test.tsx src/features/today/StatusCockpit.test.tsx src/features/today/todayMascotPlaceholders.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run the full frontend suite**

Run: `npm test`
Expected: PASS.

- [ ] **Step 3: Build the app**

Run: `npm run build`
Expected: TypeScript and Vite build succeed.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check` and `git status --short`.
Expected: no whitespace errors; pre-existing user changes remain intact.
