# Today Cockpit Status Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Today page around one status cockpit, synchronize the header and page status, and let workday reminders switch status automatically.

**Architecture:** A React context owns the canonical work status and exposes one switching API to the shell, cockpit, lunch action, and reminder automation. The Today page becomes a full-width cockpit followed by a task column and a compact tools column; deterministic reaction copy and local mascot assets provide the meme layer without changing Rust or SQLite.

**Tech Stack:** React 19, TypeScript, CSS, Tauri IPC, Vitest, Testing Library

---

## File structure

- Create `src/features/today/WorkStatusContext.tsx`: canonical status loading and mutation.
- Create `src/features/today/StatusCockpit.tsx` and `.css`: countdown/status composition.
- Create `src/features/today/workStatusReaction.ts`: deterministic meme copy and mascot mapping.
- Create `src/features/today/useWorkdayStatusAutomation.ts`: reminder-to-status orchestration.
- Create `src/features/today/WorkdayStatusNotice.tsx` and `.css`: success/error feedback.
- Modify `src/shared/shell/AppShell.tsx` and `.css`: provider boundary and dynamic header status.
- Modify `src/features/today/WorkStatusPanel.tsx`: controlled compact switcher.
- Modify `src/pages/TodayPage.tsx` and `.css`: remove duplicate cards and establish the new grid.
- Modify `src/features/today/WorkScheduleEditor.tsx` and `.css`: compact workday tools.
- Modify tests beside each unit; do not change Rust or database schema.

### Task 1: Canonical work status

**Files:**
- Create: `src/features/today/WorkStatusContext.tsx`
- Modify: `src/shared/shell/AppShell.tsx`
- Modify: `src/features/today/WorkStatusPanel.tsx`
- Test: `src/features/today/WorkStatusContext.test.tsx`

- [x] **Step 1: Write the provider contract**

```ts
type WorkStatusContextValue = {
  statuses: FixedWorkStatus[];
  current: CurrentWorkStatus | null;
  loading: boolean;
  error: string | null;
  switchingId: string | null;
  reload: () => Promise<void>;
  switchStatus: (statusType: string) => Promise<CurrentWorkStatus>;
  clearError: () => void;
};
```

- [x] **Step 2: Make the shell and switcher consume the provider**

```tsx
<WorkStatusProvider>
  <AppShellContent />
</WorkStatusProvider>
```

- [x] **Step 3: Test loading, switching, and failure retention**

Run: `npm test -- --run src/features/today/WorkStatusContext.test.tsx`

Expected: provider test passes and the previous current status remains rendered after a rejected switch.

### Task 2: Automatic workday reminder switching

**Files:**
- Create: `src/features/today/useWorkdayStatusAutomation.ts`
- Create: `src/features/today/WorkdayStatusNotice.tsx`
- Create: `src/features/today/WorkdayStatusNotice.css`
- Test: `src/features/today/useWorkdayStatusAutomation.test.tsx`

- [x] **Step 1: Implement one-attempt automation**

```ts
if (manager.activeReminder && attemptingId.current !== manager.activeReminder.id) {
  attemptingId.current = manager.activeReminder.id;
  void attempt(manager.activeReminder, true);
}
```

- [x] **Step 2: Surface success and retryable failure**

```ts
type WorkdayStatusNotice = {
  tone: "success" | "error";
  title: string;
  message: string;
};
```

- [x] **Step 3: Test success, failure, retry, and no duplicate call**

Run: `npm test -- --run src/features/today/useWorkdayStatusAutomation.test.tsx`

Expected: one status IPC call per due reminder; retry is only exposed after failure.

### Task 3: Single-line Today cockpit

**Files:**
- Create: `src/features/today/StatusCockpit.tsx`
- Create: `src/features/today/StatusCockpit.css`
- Create: `src/features/today/workStatusReaction.ts`
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/TodayPage.css`
- Test: `src/features/today/workStatusReaction.test.ts`

- [x] **Step 1: Compose countdown and status reaction in one hero**

```tsx
<StatusCockpit schedule={workSchedule}>
  <WorkCountdownBanner display={workCountdown} schedule={workSchedule} />
</StatusCockpit>
```

- [x] **Step 2: Remove duplicate WorkdayBrief and receipt footer rendering**

The page grid must be `"stage stage" "tasks schedule"`; the narrow layout must be `stage -> tasks -> schedule`.

- [x] **Step 3: Test deterministic reaction selection**

Run: `npm test -- --run src/features/today/workStatusReaction.test.ts`

Expected: identical status/date/mood returns identical copy and the correct mascot state.

### Task 4: Compact workday tools

**Files:**
- Modify: `src/features/today/WorkScheduleEditor.tsx`
- Modify: `src/features/today/WorkScheduleEditor.css`
- Test: `src/features/today/WorkScheduleEditor.test.tsx`

- [x] **Step 1: Rename the card and expose reminder target state in summaries**

```tsx
<small>{reminder.message} · 自动切到{reminderStatusLabel(reminder.suggestedStatus)}</small>
```

- [x] **Step 2: Keep row editors collapsed and reduce always-visible help text**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx`

Expected: both existing schedule-save tests pass and reminder summaries remain keyboard-expandable.

### Task 5: Mascot and meme layer

**Files:**
- Modify: `src/assets/mascot/index.ts`
- Modify: `src/assets/mascot/types.ts` only if new bitmap assets are successfully generated.
- Add: versioned PNG files under `src/assets/mascot/workhorse/reactions/` only when built-in image generation succeeds.

- [x] **Step 1: Use existing assets as safe fallback**

```ts
const WORK_STATUS_TO_MASCOT: Record<string, MascotState> = {
  meeting: "meeting-empty",
  chased_by_requirements: "offwork-run",
  slacking: "fish-relax",
  lunch: "lunch-happy",
};
```

- [x] **Step 2: Add generated assets only through the built-in image workflow**

Expected: transparent local PNG files, no remote URLs, no overwritten existing assets. If the built-in service is unavailable, retain the fallback mapping and do not use CLI without explicit user approval.

### Task 6: Verification

**Files:**
- Test: all files under `src/**/*.test.ts` and `src/**/*.test.tsx`

- [x] **Step 1: Run focused tests**

Run: `npm test -- --run src/features/today/WorkStatusContext.test.tsx src/features/today/useWorkdayStatusAutomation.test.tsx src/features/today/workStatusReaction.test.ts`

Expected: all focused tests pass.

- [x] **Step 2: Run full suite and build**

Run: `npm test && npm run build`

Expected: all tests pass and Vite emits `dist/` successfully.

- [x] **Step 3: Visual QA**

Run the existing Tauri dev process, inspect desktop and 390px layouts, exercise the top navigation, and verify the header, cockpit, reaction copy, tasks, and tools remain synchronized without horizontal overflow. Status switching and failure retention are covered by provider and automation tests.
