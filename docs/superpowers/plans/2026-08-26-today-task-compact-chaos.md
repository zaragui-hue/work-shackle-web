# Today Task Compact Chaos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compress formal task metadata into one row and give overdue debt cards a time-based, escalating “out of control” stamp while retaining their progress bars.

**Architecture:** Keep `TodayTaskCard` as the layout switch and move all copy/tier decisions into pure display helpers. Reuse the existing DDL progress hook for live remaining time, expose a text-only mode for formal cards, and retain the full progress component for overdue cards.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, CSS, date-fns, Vite

---

### Task 1: Add pure display mappings

**Files:**
- Modify: `src/features/today/ddlProgressDisplay.ts`
- Test: `src/features/today/ddlProgressDisplay.test.ts`

- [ ] **Step 1: Write failing tests for status copy, urgency tone, and overdue boundaries**

```ts
expect(taskStatusStampCopy("not_started")).toBe("🫥 活还没醒");
expect(taskStatusStampCopy("in_progress")).toBe("🐴 牛马强制上线");
expect(taskStatusStampCopy("paused")).toBe("🫠 工位融化中");
expect(taskStatusStampCopy("waiting")).toBe("🤡 等一个天降奇迹");
expect(taskUrgencyTone(1)).toBe("low");
expect(taskUrgencyTone(2)).toBe("normal");
expect(taskUrgencyTone(3)).toBe("urgent");
expect(overdueChaosLevel(now - 23 * HOUR, now)).toBe("slightly");
expect(overdueChaosLevel(now - 24 * HOUR, now)).toBe("serious");
expect(overdueChaosLevel(now - 72 * HOUR, now)).toBe("gave_up");
```

- [ ] **Step 2: Run the display-helper test and verify it fails**

Run: `npm test -- src/features/today/ddlProgressDisplay.test.ts`

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Implement typed pure helpers**

```ts
export type OverdueChaosLevel = "slightly" | "serious" | "gave_up";

export function overdueChaosLevel(deadlineAtMs: number, nowMs = Date.now()): OverdueChaosLevel {
  const overdueMs = Math.max(0, nowMs - deadlineAtMs);
  if (overdueMs >= 72 * 60 * 60 * 1000) return "gave_up";
  if (overdueMs >= 24 * 60 * 60 * 1000) return "serious";
  return "slightly";
}
```

Add exhaustive task-status copy and priority-tone mappings. Terminal states retain safe fallback labels even though they do not appear in the formal list.

```ts
const STATUS_STAMP_COPY: Record<TaskStatus, string> = {
  not_started: "🫥 活还没醒",
  in_progress: "🐴 牛马强制上线",
  paused: "🫠 工位融化中",
  waiting: "🤡 等一个天降奇迹",
  completed: "✅ 活干完了",
  cancelled: "🗑️ 活消失了",
};

export function taskUrgencyTone(priority: number): "low" | "normal" | "urgent" {
  if (priority <= 1) return "low";
  if (priority >= 3) return "urgent";
  return "normal";
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm test -- src/features/today/ddlProgressDisplay.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the helper change**

```bash
git add src/features/today/ddlProgressDisplay.ts src/features/today/ddlProgressDisplay.test.ts
git commit -m "feat: classify chaotic task stamps"
```

### Task 2: Support a compact remaining-time presentation

**Files:**
- Modify: `src/features/today/DdlTimeProgress.tsx`
- Modify: `src/features/today/DdlTimeProgress.css`
- Test: `src/features/today/DdlTimeProgress.test.tsx`

- [ ] **Step 1: Write a failing text-only mode test**

```tsx
render(
  <DdlTimeProgress
    plannedAtMs={1_000}
    deadlineAtMs={10_000}
    presentation="remaining-only"
  />,
);
expect(screen.getByTestId("ddl-remaining-inline")).toBeTruthy();
expect(screen.queryByRole("progressbar")).toBeNull();
```

- [ ] **Step 2: Run the component test and verify it fails**

Run: `npm test -- src/features/today/DdlTimeProgress.test.tsx`

Expected: FAIL because `presentation` is not defined.

- [ ] **Step 3: Add the presentation prop**

```tsx
type DdlTimeProgressProps = {
  plannedAtMs: number;
  deadlineAtMs?: number;
  showRemaining?: boolean;
  presentation?: "full" | "remaining-only";
};

if (presentation === "remaining-only") {
  return <span data-testid="ddl-remaining-inline" className="ddl-time-progress__remaining-inline">{remainingText}</span>;
}
```

The hook and one-second timer remain shared between both presentations.

- [ ] **Step 4: Run the component test and verify it passes**

Run: `npm test -- src/features/today/DdlTimeProgress.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the compact progress presentation**

```bash
git add src/features/today/DdlTimeProgress.tsx src/features/today/DdlTimeProgress.css src/features/today/DdlTimeProgress.test.tsx
git commit -m "feat: add inline DDL countdown"
```

### Task 3: Reshape formal and overdue cards

**Files:**
- Modify: `src/features/today/TodayTaskCard.tsx`
- Modify: `src/features/today/TodayTaskCard.css`
- Test: `src/features/today/TodayTaskBoard.test.tsx`

- [ ] **Step 1: Write failing card behavior tests**

```tsx
expect(screen.getByText("🐴 牛马强制上线")).toBeTruthy();
expect(screen.getByLabelText("任务状态：进行中，紧急程度：有点急")).toBeTruthy();
expect(screen.getByTestId("formal-task-meta").textContent).toMatch(/还剩.*计划.*DDL/);
expect(screen.getByText("严重超时")).toBeTruthy();
expect(screen.getByRole("progressbar", { name: "时间进度" })).toBeTruthy();
```

- [ ] **Step 2: Run the board test and verify it fails**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx`

Expected: FAIL on the new stamp copy, combined accessibility label, metadata row, and overdue tier.

- [ ] **Step 3: Implement the new card composition**

For formal cards, render one stamp using `taskStatusStampCopy(task.status)` and `taskUrgencyTone(task.priority)`, then render one `formal-task-meta` row containing the remaining-only DDL component, planned time, DDL, and optional contact.

For overdue cards, compute the current tier from `deadlineAtMs`, render the corresponding `有点超时 / 严重超时 / 放弃挣扎` stamp beside the title, retain exact overdue text, and keep `DdlTimeProgress` in full mode.

```tsx
<span
  className={`today-task-card__status-stamp today-task-card__status-stamp--urgency-${taskUrgencyTone(task.priority)}`}
  aria-label={`任务状态：${statusLabel(task.status)}，紧急程度：${priorityLabel(task.priority)}`}
>
  {taskStatusStampCopy(task.status)}
</span>

<div className="today-task-card__formal-meta" data-testid="formal-task-meta">
  <DdlTimeProgress plannedAtMs={task.plannedAtMs} deadlineAtMs={task.deadlineAtMs} presentation="remaining-only" />
  <span>计划 {formatPlannedTime(task.plannedAtMs)}</span>
  <span>DDL {formatDeadlineShort(task.deadlineAtMs)}</span>
</div>
```

- [ ] **Step 4: Apply deliberate visual styling**

Use existing paper, anchor, signal, reaction, and danger tokens. Spend the visual emphasis on stamps only: urgency changes formal-stamp fill; overdue tiers progressively increase red saturation, shadow depth, scale, and rotation. Keep metadata quiet, single-line, and tabular.

- [ ] **Step 5: Add responsive and reduced-motion rules**

Desktop metadata stays on one row. At 520px it may wrap once with contact last. Remove rotations and animated transforms under `prefers-reduced-motion: reduce` while retaining color and copy distinctions.

- [ ] **Step 6: Run focused tests and verify they pass**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx src/features/today/DdlTimeProgress.test.tsx src/features/today/ddlProgressDisplay.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit the card redesign**

```bash
git add src/features/today/TodayTaskCard.tsx src/features/today/TodayTaskCard.css src/features/today/TodayTaskBoard.test.tsx
git commit -m "feat: compact and dramatize today task cards"
```

### Task 4: Update the development preview and complete verification

**Files:**
- Modify: `src/pages/DesignPreviewPage.tsx`

- [ ] **Step 1: Include overdue examples for all three tiers in the preview**

Create preview debts at 12, 36, and 96 hours overdue so every stamp can be checked without touching real workspace data.

```ts
overdueTasks: [
  task("debt-light", "客户说再润色一下", now - 24 * hour, now - 12 * hour, 1, "paused"),
  task("debt-serious", "需求已经改到第八版", now - 60 * hour, now - 36 * hour, 2, "waiting"),
  task("debt-gave-up", "上周五说马上要的活", now - 120 * hour, now - 96 * hour, 3, "paused"),
],
```

- [ ] **Step 2: Run the complete frontend suite**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite build successfully.

- [ ] **Step 4: Inspect the local design preview**

Open `http://localhost:1420/?preview=today`, verify desktop and narrow layouts, confirm the metadata row is compact, all overdue progress bars remain, and auto-start broadcast still retracts after four seconds.

- [ ] **Step 5: Commit preview and verification support**

```bash
git add src/pages/DesignPreviewPage.tsx
git commit -m "chore: preview overdue chaos tiers"
```

- [ ] **Step 6: Check the final worktree**

Run: `git diff --check && git status --short`

Expected: no whitespace errors and no uncommitted feature files.

### Task 5: Restore the formal-task progress rail

**Files:**
- Create: `src/features/today/FormalTaskTiming.tsx`
- Modify: `src/features/today/TodayTaskCard.tsx`
- Modify: `src/features/today/TodayTaskCard.css`
- Test: `src/features/today/TodayTaskBoard.test.tsx`

- [ ] **Step 1: Strengthen the formal-card test**

```tsx
const meta = screen.getByTestId("formal-task-meta");
expect(meta.textContent).toMatch(/(还剩|已逾期).*计划.*DDL.*产品经理/);
expect(
  screen.getByRole("progressbar", { name: "压缩卡片的时间进度" }),
).toBeTruthy();
```

- [ ] **Step 2: Run the board test and verify the new assertion fails**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx`

Expected: FAIL because formal tasks currently render no progressbar.

- [ ] **Step 3: Add one compact timing component**

```tsx
export function FormalTaskTiming({ task }: { task: Task }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  const ratio = task.deadlineAtMs == null
    ? 0
    : (nowMs - task.plannedAtMs) / (task.deadlineAtMs - task.plannedAtMs);
  const fillPercent = ddlProgressFillPercent(ratio);
  const remainingText = task.deadlineAtMs == null
    ? null
    : task.deadlineAtMs <= nowMs
      ? formatOverdueDuration(task.deadlineAtMs, nowMs)
      : formatRemainingUntilDeadline(task.deadlineAtMs, nowMs);

  return (
    <div className="today-task-card__formal-timing">
      <div className="today-task-card__formal-meta" data-testid="formal-task-meta">
        {remainingText ? <span>{remainingText}</span> : null}
        <span className="today-task-card__formal-meta-item">
          计划 {formatPlannedTime(task.plannedAtMs)}
        </span>
        {task.deadlineAtMs != null ? (
          <span className="today-task-card__formal-meta-item">
            DDL {formatDeadlineShort(task.deadlineAtMs)}
          </span>
        ) : null}
        {task.contactSnapshot?.trim() ? (
          <span className="today-task-card__contact">{formatContact(task)}</span>
        ) : null}
      </div>
      {task.deadlineAtMs != null ? (
        <div
          className="today-task-card__formal-progress"
          role="progressbar"
          aria-label={`${task.title}的时间进度`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(fillPercent)}
        >
          <span style={{ width: `${fillPercent}%` }} />
        </div>
      ) : null}
    </div>
  );
}
```

The component owns the one-second clock used by both remaining copy and the rail, so it does not duplicate backend progress requests.

- [ ] **Step 4: Replace the formal metadata block with `FormalTaskTiming`**

```tsx
{variant === "formal" ? <FormalTaskTiming task={task} /> : null}
```

- [ ] **Step 5: Style the retained rail without restoring the old extra rows**

```css
.today-task-card__formal-timing { display: grid; gap: 6px; }
.today-task-card__formal-progress {
  height: 8px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(61, 43, 31, 0.08);
}
.today-task-card__formal-progress > span {
  display: block;
  height: 100%;
  background: var(--color-green);
}
```

- [ ] **Step 6: Run focused tests, full tests, and build**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx && npm test && npm run build`

Expected: all tests pass and Vite builds successfully.

- [ ] **Step 7: Commit the correction**

```bash
git add src/features/today/FormalTaskTiming.tsx src/features/today/TodayTaskCard.tsx src/features/today/TodayTaskCard.css src/features/today/TodayTaskBoard.test.tsx
git commit -m "fix: retain formal task progress bars"
```
