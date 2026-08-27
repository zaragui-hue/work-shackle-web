# Today Task Cyber Countdown and Overdue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved restrained-cyber Today task list with a countdown marker attached to the time rail, a deduplicated overdue section, and full red overdue rails.

**Architecture:** Keep backend query contracts and task mutation callbacks unchanged. Add pure display helpers for overdue prompts and visible-list deduplication, extend the existing timing renderers with marker markup, and style the marker through component-scoped CSS variables so desktop and mobile use the same semantic structure.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Vite

---

## File map

- Modify `src/features/today/todayDisplay.ts`: pure overdue prompt and list-deduplication helpers.
- Modify `src/features/today/todayDisplay.test.ts`: helper coverage for duplicate IDs and severity copy.
- Modify `src/features/today/FormalTaskTiming.tsx`: normal-task countdown marker markup and accessible progress values.
- Modify `src/features/today/DdlTimeProgress.tsx`: optional rail-marker presentation and forced full overdue rail.
- Modify `src/features/today/DdlTimeProgress.css`: reusable marker positioning and overdue end-stop treatment.
- Modify `src/features/today/TodayTaskCard.tsx`: use the overdue rail marker and severity prompt.
- Modify `src/features/today/TodayTaskCard.css`: restrained card hierarchy, larger copy, marker rail integration, and responsive rules.
- Modify `src/features/today/TodayTaskBoard.tsx`: deduplicate lists, rename the overdue section, remove its hint, and show the debt count.
- Modify `src/features/today/TodayTaskBoard.css`: debt heading/count layout.
- Modify `src/features/today/TodayTaskBoard.test.tsx`: user-visible behavior and accessibility assertions.
- Modify `src/pages/TodayPage.tsx`: approved card title, toolbar copy, and create label.
- Modify `src/pages/DesignPreviewPage.tsx`: keep the local preview aligned with production copy and sample notes.

### Task 1: Lock down display behavior with failing tests

**Files:**
- Modify: `src/features/today/todayDisplay.test.ts`
- Modify: `src/features/today/TodayTaskBoard.test.tsx`

- [ ] **Step 1: Add helper tests**

Add assertions that a task ID present in `overdueTasks` is removed from `formalTasks`, while unique tasks preserve backend order. Add exact prompt assertions for less than 24 hours, 24–72 hours, and at least 72 hours overdue.

- [ ] **Step 2: Add board behavior tests**

Render duplicate formal/overdue input and assert one visible title inside the overdue list. Assert the overdue heading is `昨日烂尾现场`, contains `1 笔旧账`, and has no explanatory hint. Assert formal timing contains a marker with remaining text, while overdue timing exposes a progressbar with `aria-valuenow="100"` and a marker containing `已经炸了`.

- [ ] **Step 3: Run the focused tests and verify failure**

Run: `npm test -- src/features/today/todayDisplay.test.ts src/features/today/TodayTaskBoard.test.tsx`

Expected: FAIL because list deduplication, overdue prompt copy, marker markup, and the renamed section do not exist yet.

### Task 2: Add pure deduplication and overdue-copy helpers

**Files:**
- Modify: `src/features/today/todayDisplay.ts`
- Modify: `src/features/today/todayDisplay.test.ts`

- [ ] **Step 1: Implement visible list derivation**

Export `dedupeTodayTaskGroups<T extends { id: string }>(formalTasks: T[], overdueTasks: T[])`. Build a `Set` of overdue IDs and return formal tasks filtered against the set plus the unchanged overdue array.

- [ ] **Step 2: Implement severity prompts**

Export `overdueTreatmentPrompt(deadlineAtMs: number, nowMs = Date.now())`. Return the three approved strings using 24-hour and 72-hour thresholds.

- [ ] **Step 3: Run helper tests**

Run: `npm test -- src/features/today/todayDisplay.test.ts`

Expected: PASS.

### Task 3: Attach countdown markers to timing rails

**Files:**
- Modify: `src/features/today/FormalTaskTiming.tsx`
- Modify: `src/features/today/DdlTimeProgress.tsx`
- Modify: `src/features/today/DdlTimeProgress.css`

- [ ] **Step 1: Render the formal marker**

In `FormalTaskTiming`, remove remaining text from the metadata row. Add a marker inside the progress container, set `--task-progress` to the clamped fill percentage, label it `距离爆炸` for future deadlines and `已经炸了` for overdue deadlines, and render the existing remaining/overdue duration as its numeric copy.

- [ ] **Step 2: Extend `DdlTimeProgress`**

Add `presentation="track-marker"` and `forceFull` props. For this presentation, render a track with a marker; use 100% fill and `aria-valuenow={100}` when forced, and use the `已经炸了` label for overdue tasks. Keep existing `full` and `remaining-only` consumers unchanged.

- [ ] **Step 3: Style bounded marker positioning**

Use a CSS custom property for marker position, `max()`/`min()` clamping for ordinary markers, and right alignment for forced overdue markers. Use ink/blue for ordinary rails and danger red for overdue rails. Disable transitions under reduced motion.

- [ ] **Step 4: Run component tests**

Run: `npm test -- src/features/today/DdlTimeProgress.test.tsx src/features/today/TodayTaskBoard.test.tsx`

Expected: marker and progress assertions PASS.

### Task 4: Reshape cards and the overdue section

**Files:**
- Modify: `src/features/today/TodayTaskCard.tsx`
- Modify: `src/features/today/TodayTaskCard.css`
- Modify: `src/features/today/TodayTaskBoard.tsx`
- Modify: `src/features/today/TodayTaskBoard.css`

- [ ] **Step 1: Wire overdue copy and timing**

Render `overdueTreatmentPrompt` below overdue card metadata and call `DdlTimeProgress` with `presentation="track-marker"`, `forceFull`, and hidden legacy meta. Preserve the priority menu and status selector.

- [ ] **Step 2: Deduplicate and rename the section**

Use `dedupeTodayTaskGroups` before rendering. Pass `昨日烂尾现场` without a hint and render a count badge containing `${overdueTasks.length} 笔旧账`.

- [ ] **Step 3: Apply the restrained visual hierarchy**

Increase title and note sizes to the approved range, use hard ink dividers, reserve blue for normal rails and red for overdue states, remove decorative rotation, and keep card height compact. Add mobile rules for marker labels, long titles, and the section count.

- [ ] **Step 4: Run board tests**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx`

Expected: PASS.

### Task 5: Align production and preview copy

**Files:**
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/TodayPage.css`
- Modify: `src/pages/DesignPreviewPage.tsx`

- [ ] **Step 1: Update production copy**

Change the card title to `今天这些破事 / 先狠狠干掉`, the toolbar line to `⚠ 别让 DDL 先动手`, and the create button to `＋ 再塞一件`.

- [ ] **Step 2: Update preview copy and samples**

Mirror the same title and toolbar labels in `DesignPreviewPage`, keep two formal and three severity-spanning overdue sample tasks, and add overdue notes so visual QA covers the new prompt hierarchy.

- [ ] **Step 3: Run the complete test suite and build**

Run: `npm test`

Expected: all Vitest suites PASS.

Run: `npm run build`

Expected: TypeScript and Vite build PASS.

### Task 6: Visual QA and delivery

**Files:**
- Verify: `src/features/today/TodayTaskCard.css`
- Verify: `src/features/today/TodayTaskBoard.css`
- Verify: `src/pages/TodayPage.css`

- [ ] **Step 1: Inspect desktop preview**

Open `http://127.0.0.1:1420/?preview=today` at desktop width. Verify normal markers follow progress, overdue rails are full red, overdue entries are not repeated above, notes remain readable, and the debt heading has no hint.

- [ ] **Step 2: Inspect 390px preview**

At 390px width, verify title and note truncation, priority/status controls, marker containment, debt count, and action focus states do not overlap.

- [ ] **Step 3: Commit implementation**

Run:

```bash
git add src/features/today src/pages/TodayPage.tsx src/pages/TodayPage.css src/pages/DesignPreviewPage.tsx docs/superpowers
git commit -m "feat: redesign today task countdown rails"
```

Expected: one implementation commit with tests, styles, preview fixtures, design spec, and plan.

