# Workstation Alarm Comfortable Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver compact always-active workstation alarm cards with explicit per-card save/cancel, edit locking, safe one-click clearing, and persistent cross-day reuse.

**Architecture:** Upgrade persisted reminder rows to a v3 always-active model while keeping unsaved edits in a separate hook-owned draft. The manager becomes the transaction boundary for save, cancel, delete, and clear operations. The editor renders the selected compact A layout and disables competing actions while a draft is open; status automation continues consuming only committed rows.

**Tech Stack:** React 19, TypeScript, localStorage, Vitest, Testing Library, CSS.

---

### Task 1: Upgrade persisted reminders to always-active v3 rows

**Files:**
- Modify: `src/features/today/workdayReminders.ts`
- Modify: `src/features/today/workdayReminders.test.ts`

- [ ] **Step 1: Add failing migration and empty-list tests**

```ts
expect(loadWorkdayReminders(storage, schedule)).toEqual([
  expect.objectContaining({ id: "meeting", statusType: "meeting" }),
]);
expect(loadWorkdayReminders(clearedStorage, schedule)).toEqual([]);
```

Cover v2 enabled rows migrating, v2 disabled drafts being dropped, v3 empty arrays remaining empty, and cross-date calls returning the same rows.

- [ ] **Step 2: Run the focused test**

Run: `npm test -- --run src/features/today/workdayReminders.test.ts`
Expected: FAIL because the current v2 model contains `enabled` and uses the v2 key.

- [ ] **Step 3: Implement the v3 model and migration**

```ts
export type WorkdayReminder = {
  id: string;
  startTime: string;
  endTime: string;
  statusType: string;
  createdAtMs: number;
};

export const WORKDAY_REMINDER_STORAGE_KEY = "work-shackle.workday-reminders.v3";
export const V2_WORKDAY_REMINDER_STORAGE_KEY = "work-shackle.workday-reminders.v2";
```

Remove all runtime `enabled` checks, migrate only v2 rows where `enabled === true`, and preserve a stored v3 empty array.

- [ ] **Step 4: Re-run the test**

Run: `npm test -- --run src/features/today/workdayReminders.test.ts`
Expected: PASS.

### Task 2: Replace immediate writes with a draft transaction manager

**Files:**
- Modify: `src/features/today/useWorkdayReminders.ts`
- Modify: `src/features/today/useWorkdayReminders.test.ts`

- [ ] **Step 1: Add failing manager tests**

Test that add/edit produce a draft without changing committed rows, other actions remain locked, cancel discards, save validates and persists, delete persists removal, and clear persists an empty array.

```ts
expect(result.current.draft?.mode).toBe("create");
expect(result.current.reminders).toEqual([]);
act(() => result.current.saveDraft());
expect(result.current.reminders).toHaveLength(1);
```

- [ ] **Step 2: Run the hook test**

Run: `npm test -- --run src/features/today/useWorkdayReminders.test.ts`
Expected: FAIL because the manager currently persists every field change.

- [ ] **Step 3: Implement the manager contract**

```ts
type WorkdayReminderDraft = {
  mode: "create" | "edit";
  value: WorkdayReminder;
  error: string | null;
};

type WorkdayReminderManager = {
  reminders: WorkdayReminder[];
  activeReminder: WorkdayReminder | null;
  draft: WorkdayReminderDraft | null;
  storageError: string | null;
  startAdd(): void;
  startEdit(id: string): void;
  updateDraft(patch: Partial<WorkdayReminder>): void;
  saveDraft(): void;
  cancelDraft(): void;
  deleteDraftReminder(): void;
  clearAll(): boolean;
};
```

Validate only on `saveDraft`, write before committing React state, and leave the draft open when validation or persistence fails.

- [ ] **Step 4: Re-run the hook test**

Run: `npm test -- --run src/features/today/useWorkdayReminders.test.ts`
Expected: PASS.

### Task 3: Implement the compact A card layout and clear confirmation

**Files:**
- Modify: `src/features/today/WorkScheduleEditor.tsx`
- Modify: `src/features/today/WorkScheduleEditor.css`
- Modify: `src/features/today/WorkScheduleEditor.test.tsx`

- [ ] **Step 1: Add failing interaction tests**

Assert that “上班过程提醒” and activation copy are absent; saved rows show only time, content, and edit; add/edit lock competing controls; save/cancel work; and clear requires “确认清空”.

- [ ] **Step 2: Run the component test**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx`
Expected: FAIL against the current accordion with activation state.

- [ ] **Step 3: Implement the selected layout**

Render a single title, compact rows, one emphasized draft editor, explicit `取消` and `保存` buttons, and an edit-only `删除` action. When a draft exists, disable other rows, add, and clear; show `请先保存或取消当前修改`.

- [ ] **Step 4: Implement two-stage clear confirmation**

Keep confirmation UI local to `WorkScheduleEditor`: first click enters confirmation, “取消” exits, and “确认清空” calls `manager.clearAll()` before closing confirmation.

- [ ] **Step 5: Apply comfortable-card CSS**

Remove timeline decorations and state badges. Use a single-line summary, restrained spacing, a dark border/yellow shadow only for the draft, and stack time controls below 420px.

- [ ] **Step 6: Re-run the component test**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx`
Expected: PASS.

### Task 4: Update automation consumers and verify the app

**Files:**
- Modify: `src/features/today/useWorkdayStatusAutomation.test.tsx`
- Modify: `src/features/today/WorkdayReminderPrompt.tsx`
- Verify: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Remove `enabled` from automation fixtures and assertions**

Use committed v3 rows only; the active-range and prepare-to-leave expectations remain unchanged.

- [ ] **Step 2: Run the related suite**

Run: `npm test -- --run src/features/today/workdayReminders.test.ts src/features/today/useWorkdayReminders.test.ts src/features/today/WorkScheduleEditor.test.tsx src/features/today/useWorkdayStatusAutomation.test.tsx`
Expected: PASS.

- [ ] **Step 3: Run full verification**

Run: `npm test`
Expected: all tests PASS.

Run: `npm run build`
Expected: TypeScript and Vite build PASS.

- [ ] **Step 4: Inspect the final diff**

Run: `git diff --check` and `git status --short`.
Expected: no whitespace errors and no unrelated files modified.
