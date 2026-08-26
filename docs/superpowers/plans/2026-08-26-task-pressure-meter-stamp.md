# Task Pressure Meter Stamp Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the formal-task status stamp with a time-pressure-first stamp that combines the live percentage, matching workhorse reaction, task-status joke, and auto-start marker while retaining the compact progress rail.

**Architecture:** A pure pressure model will mirror the Rust DDL thresholds and be refreshed by one React hook per formal card. `TodayTaskCard` passes the same pressure object to the right-hand stamp and lower timing rail, so the percentage, horse reaction, countdown, and bar cannot drift apart.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, existing Mascot assets, CSS, Vite

---

### Task 1: Create the shared pressure model

**Files:**
- Create: `src/features/today/taskPressure.ts`
- Create: `src/features/today/taskPressure.test.ts`

- [ ] **Step 1: Write boundary and formatting tests**

```ts
expect(buildTaskPressure(0, 1_000, 400).emotion).toBe("calm");
expect(buildTaskPressure(0, 1_000, 401).emotion).toBe("notice");
expect(buildTaskPressure(0, 1_000, 650).emotion).toBe("notice");
expect(buildTaskPressure(0, 1_000, 651).emotion).toBe("anxious");
expect(buildTaskPressure(0, 1_000, 800).emotion).toBe("anxious");
expect(buildTaskPressure(0, 1_000, 801).emotion).toBe("panic");
expect(buildTaskPressure(0, 1_000, 950).emotion).toBe("panic");
expect(buildTaskPressure(0, 1_000, 951).emotion).toBe("burning");
expect(buildTaskPressure(0, 1_000, 1_001).emotion).toBe("overdue");
expect(buildTaskPressure(0, 1_000, 10_000).percentLabel).toBe("999%+");
expect(buildTaskPressure(1_000, 1_000, 1_000).percentLabel).toBe("--%");
```

- [ ] **Step 2: Run the test and verify it fails because the module is missing**

Run: `npm test -- src/features/today/taskPressure.test.ts`

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement the pure model**

```ts
export type TaskPressure = {
  valid: boolean;
  progressRatio: number;
  fillPercent: number;
  percentLabel: string;
  emotion: DdlEmotion;
  nowMs: number;
};

export function buildTaskPressure(plannedAtMs: number, deadlineAtMs: number | undefined, nowMs: number): TaskPressure {
  if (deadlineAtMs == null || deadlineAtMs <= plannedAtMs) {
    return { valid: false, progressRatio: 0, fillPercent: 0, percentLabel: "--%", emotion: "calm", nowMs };
  }
  const progressRatio = nowMs <= plannedAtMs ? 0 : (nowMs - plannedAtMs) / (deadlineAtMs - plannedAtMs);
  const percent = Math.round(progressRatio * 100);
  const emotion = progressRatio > 1 ? "overdue"
    : progressRatio > 0.95 ? "burning"
    : progressRatio > 0.8 ? "panic"
    : progressRatio > 0.65 ? "anxious"
    : progressRatio > 0.4 ? "notice"
    : "calm";
  return {
    valid: true,
    progressRatio,
    fillPercent: Math.min(100, Math.max(0, progressRatio * 100)),
    percentLabel: percent > 999 ? "999%+" : `${Math.max(0, percent)}%`,
    emotion,
    nowMs,
  };
}
```

- [ ] **Step 4: Run the pressure-model test and verify it passes**

Run: `npm test -- src/features/today/taskPressure.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the model**

```bash
git add src/features/today/taskPressure.ts src/features/today/taskPressure.test.ts
git commit -m "feat: model formal task pressure"
```

### Task 2: Add one live pressure hook

**Files:**
- Create: `src/features/today/useTaskPressure.ts`
- Create: `src/features/today/useTaskPressure.test.ts`

- [ ] **Step 1: Write a fake-timer hook test**

```ts
vi.setSystemTime(500);
const { result } = renderHook(() => useTaskPressure(0, 1_000));
expect(result.current.percentLabel).toBe("50%");
act(() => {
  vi.setSystemTime(800);
  vi.advanceTimersByTime(1_000);
});
expect(result.current.percentLabel).toBe("80%");
```

- [ ] **Step 2: Run the hook test and verify it fails**

Run: `npm test -- src/features/today/useTaskPressure.test.ts`

Expected: FAIL because `useTaskPressure` is missing.

- [ ] **Step 3: Implement a one-second hook**

```ts
export function useTaskPressure(plannedAtMs: number, deadlineAtMs?: number): TaskPressure {
  const [nowMs, setNowMs] = useState(() => Date.now());
  useEffect(() => {
    if (deadlineAtMs == null || deadlineAtMs <= plannedAtMs) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, [plannedAtMs, deadlineAtMs]);
  return buildTaskPressure(plannedAtMs, deadlineAtMs, nowMs);
}
```

- [ ] **Step 4: Run the hook test and verify it passes**

Run: `npm test -- src/features/today/useTaskPressure.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the hook**

```bash
git add src/features/today/useTaskPressure.ts src/features/today/useTaskPressure.test.ts
git commit -m "feat: refresh formal task pressure"
```

### Task 3: Build the pressure meter stamp

**Files:**
- Create: `src/features/today/TaskPressureStamp.tsx`
- Modify: `src/features/today/TodayTaskCard.css`
- Test: `src/features/today/TodayTaskBoard.test.tsx`

- [ ] **Step 1: Replace the old stamp expectations with the combined content**

```tsx
expect(screen.getByText("50%")).toBeTruthy();
expect(screen.getByText("🐴 牛马强制上线")).toBeTruthy();
expect(document.querySelector('img[data-mascot-state="ddl-calm"]')).toBeTruthy();
expect(screen.getByLabelText(/任务状态：进行中.*时间已走过 50%/)).toBeTruthy();
```

- [ ] **Step 2: Run the board test and verify the stamp assertions fail**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx`

Expected: FAIL because the current stamp has no percentage or workhorse image.

- [ ] **Step 3: Implement the stamp component**

```tsx
export function TaskPressureStamp({ task, pressure, autoStarted }: Props) {
  return (
    <span
      className={`task-pressure-stamp task-pressure-stamp--${pressure.emotion}`}
      aria-label={`任务状态：${statusLabel(task.status)}，紧急程度：${priorityLabel(task.priority)}，时间已走过 ${pressure.percentLabel}`}
    >
      <Mascot
        state={mascotStateForDdlEmotion(pressure.emotion)}
        animation={mascotAnimationForDdlEmotion(pressure.emotion)}
        size="sm"
        className="task-pressure-stamp__mascot"
      />
      <span className="task-pressure-stamp__content" aria-hidden="true">
        <span className="task-pressure-stamp__eyebrow">TIME USED {autoStarted ? <b>AUTO</b> : null}</span>
        <strong className="task-pressure-stamp__percent">{pressure.percentLabel}</strong>
        <span className="task-pressure-stamp__status">{taskStatusStampCopy(task.status)}</span>
      </span>
    </span>
  );
}
```

- [ ] **Step 4: Style the approved A layout**

Implement a 166×66px stamp with the horse overlapping its left edge, the percentage as the largest text, the status as a compact footer, six emotion color treatments, a 142×60px mobile variant, keyboard-safe contrast, and reduced-motion overrides.

```css
.task-pressure-stamp {
  position: relative;
  width: 166px;
  min-height: 66px;
  padding: 7px 9px 7px 54px;
  border: 3px solid var(--color-anchor);
  box-shadow: 4px 4px 0 var(--color-anchor);
}
.task-pressure-stamp__mascot {
  position: absolute;
  left: -10px;
  bottom: -5px;
  width: 58px;
  height: 58px;
  border: 3px solid var(--color-anchor);
  border-radius: 50%;
}
.task-pressure-stamp__percent { font-size: 1.9rem; line-height: .9; }
.task-pressure-stamp--calm { background: #d9e7cf; }
.task-pressure-stamp--notice { background: #dfff31; }
.task-pressure-stamp--anxious { background: #ffbd45; }
.task-pressure-stamp--panic { background: #ff735c; }
.task-pressure-stamp--burning { background: #ff3f5f; color: #fff7dc; }
.task-pressure-stamp--overdue { background: var(--color-anchor); color: #ffefc2; }
```

- [ ] **Step 5: Run the board test and verify it passes**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx`

Expected: PASS.

### Task 4: Share pressure with the metadata rail

**Files:**
- Modify: `src/features/today/TodayTaskCard.tsx`
- Modify: `src/features/today/FormalTaskTiming.tsx`
- Modify: `src/features/today/TodayTaskCard.css`
- Test: `src/features/today/TodayTaskBoard.test.tsx`

- [ ] **Step 1: Compute pressure once in the card**

```tsx
const pressure = useTaskPressure(task.plannedAtMs, variant === "formal" ? task.deadlineAtMs : undefined);
```

- [ ] **Step 2: Pass the shared value to both consumers**

```tsx
{variant === "formal" ? <TaskPressureStamp task={task} pressure={pressure} autoStarted={announceAutoStart} /> : null}
{variant === "formal" ? <FormalTaskTiming task={task} pressure={pressure} /> : null}
```

- [ ] **Step 3: Remove the second timer from `FormalTaskTiming`**

Use `pressure.nowMs` for remaining/overdue copy, `pressure.fillPercent` for the bar, and `pressure.emotion` for the rail color. Keep the progressbar present only when `pressure.valid` is true.

```tsx
const remainingText = task.deadlineAtMs == null
  ? null
  : task.deadlineAtMs <= pressure.nowMs
    ? formatOverdueDuration(task.deadlineAtMs, pressure.nowMs)
    : formatRemainingUntilDeadline(task.deadlineAtMs, pressure.nowMs);

<div className={`today-task-card__formal-progress today-task-card__formal-progress--${pressure.emotion}`}>
  <span style={{ width: `${pressure.fillPercent}%` }} />
</div>
```

- [ ] **Step 4: Verify auto-start and compact-row tests**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx src/features/today/useTaskPressure.test.ts src/features/today/taskPressure.test.ts`

Expected: PASS, including the four-second broadcast dismissal.

- [ ] **Step 5: Commit the integrated stamp**

```bash
git add src/features/today/TaskPressureStamp.tsx src/features/today/TodayTaskCard.tsx src/features/today/FormalTaskTiming.tsx src/features/today/TodayTaskCard.css src/features/today/TodayTaskBoard.test.tsx
git commit -m "feat: combine task pressure into status stamp"
```

### Task 5: Complete regression and visual verification

**Files:**
- Verify: `src/pages/DesignPreviewPage.tsx`

- [ ] **Step 1: Run all frontend tests**

Run: `npm test`

Expected: all test files pass.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 3: Inspect the design preview**

Open `http://localhost:1420/?preview=today` and verify percentage dominance, matching horse reaction, status footer readability, retained progress bars, four-second broadcast retraction, and narrow-layout behavior.

- [ ] **Step 4: Check the final worktree**

Run: `git diff --check && git status --short`

Expected: no whitespace errors or uncommitted feature files.
