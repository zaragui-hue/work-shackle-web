# Inline Work Time Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the six approved Today-page annotations by making the large end time directly editable and removing or repositioning redundant visual elements.

**Architecture:** Keep the existing `WorkScheduleEditor` persistence boundary and replace its two-select `ClockSelect` with one styled native `time` input. The remaining changes are presentational adjustments inside existing countdown, runner, and task-card components; no domain calculations or Tauri commands change.

**Tech Stack:** React 19, TypeScript, CSS, Testing Library, Vitest, Vite

---

### Task 1: Make the large end time directly editable

**Files:**
- Modify: `src/features/today/WorkScheduleEditor.test.tsx`
- Modify: `src/features/today/WorkScheduleEditor.tsx`
- Modify: `src/features/today/WorkScheduleEditor.css`

- [ ] **Step 1: Write failing tests for the inline time input**

Replace hour-select interaction with the accessible large control and add failure rollback coverage:

```tsx
const timeInput = screen.getByLabelText("下班时间");
expect(timeInput.getAttribute("type")).toBe("time");
expect(screen.queryByLabelText("下班小时")).toBeNull();
expect(screen.queryByLabelText("下班分钟")).toBeNull();
fireEvent.change(timeInput, { target: { value: "19:00" } });

vi.mocked(saveDefaultWorkTimes).mockRejectedValue(new Error("保存失败"));
fireEvent.change(screen.getByLabelText("下班时间"), {
  target: { value: "19:00" },
});
await waitFor(() => expect(screen.getByLabelText("下班时间")).toHaveValue("18:30"));
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx`

Expected: FAIL because the `下班时间` input does not exist.

- [ ] **Step 3: Replace `ClockSelect` with the large native input**

Render one control in the existing large-time position:

```tsx
<input
  className="work-schedule-editor__time"
  type="time"
  aria-label="下班时间"
  value={endTime}
  disabled={saving}
  onChange={(event) => void persist(event.target.value)}
/>
```

Remove `ClockSelect`, its hour/minute helpers and constants, and the duplicate hint. In `persist`, capture the current effective value and restore it when validation or saving fails.

- [ ] **Step 4: Style the input as the existing giant badge**

Keep the yellow large-number block, remove browser chrome where supported, add a visible keyboard focus ring, and delete `.work-clock*` styles. The control must remain at least 44px high on mobile.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx`

Expected: all WorkScheduleEditor tests PASS.

### Task 2: Remove redundancy and fix visual collisions

**Files:**
- Modify: `src/features/today/WorkCountdownBanner.test.tsx`
- Modify: `src/features/today/WorkCountdownBanner.tsx`
- Modify: `src/features/today/WorkCountdownBanner.css`
- Modify: `src/features/today/WorkhorseRunner.css`
- Modify: `src/features/today/TodayTaskCard.css`

- [ ] **Step 1: Add a failing assertion for removed progress timestamps**

```tsx
expect(screen.queryByText("09:30 开工")).toBeNull();
expect(screen.queryByText("18:30 下班")).toBeNull();
expect(screen.getByText(/班味 \d+%/)).toBeTruthy();
```

- [ ] **Step 2: Run the countdown test and verify it fails**

Run: `npm test -- --run src/features/today/WorkCountdownBanner.test.tsx`

Expected: FAIL because start and end labels are still rendered.

- [ ] **Step 3: Remove progress metadata and strengthen the percent badge**

Delete `.work-countdown__progress-meta` markup and styles. Increase the percent badge to about `0.9rem`, use `var(--color-anchor)` as its background, `var(--color-signal)` as text/border, and a danger-colored offset shadow.

- [ ] **Step 4: Reposition the runner mood and upcoming priority**

Move `.workhorse-runner__mood` to the rear upper edge (`left: -6px; right: auto; top: -4px`) so it clears the horse head. Add:

```css
.today-task-card--upcoming .today-task-card__foot {
  justify-content: flex-end;
}
```

- [ ] **Step 5: Run focused tests and verify they pass**

Run: `npm test -- --run src/features/today/WorkCountdownBanner.test.tsx src/features/today/WorkScheduleEditor.test.tsx`

Expected: both test files PASS.

### Task 3: Regression and visual verification

**Files:**
- Verify: `src/features/today/WorkScheduleEditor.tsx`
- Verify: `src/features/today/WorkCountdownBanner.tsx`
- Verify: `src/features/today/TodayTaskCard.css`
- Verify: `src/features/today/WorkhorseRunner.css`

- [ ] **Step 1: Run static and full automated checks**

Run: `git diff --check`

Expected: no output.

Run: `npm test -- --run`

Expected: all tests PASS.

Run: `npm run build`

Expected: TypeScript and Vite production build PASS.

- [ ] **Step 2: Verify the live page at desktop width**

Open `http://localhost:1420/?preview=today`, change the large end-time input, and confirm it updates immediately. Confirm the two selects and progress timestamps are absent, the priority chip is right-aligned, the percent badge has stronger contrast, and the mood bubble does not cover the horse head.

- [ ] **Step 3: Verify the live page at 390px width**

Confirm `document.documentElement.scrollWidth === window.innerWidth`, the time input remains clickable, and no status or runner element clips outside its card.
