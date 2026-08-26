# Compact Today Task Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace tall today task cards with a compact two-layer layout that shows notes and supports direct priority and status changes.

**Architecture:** Add a focused priority-menu component and keep card persistence callbacks supplied by `TodayPage`. Restructure `TodayTaskCard` so its detail-open button contains only non-interactive content while priority and status controls sit in a compact action area outside that button. Reuse the existing task update IPC, today-task refresh, error surface, time calculations, and priority tone system.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Tauri task IPC.

---

## File Structure

- Create `src/features/today/TaskPriorityMenu.tsx`: accessible 1–5 priority popover with keyboard navigation and outside-click dismissal.
- Create `src/features/today/TaskPriorityMenu.test.tsx`: focused menu interaction, disabled-state, and no-op tests.
- Modify `src/features/today/TodayTaskCard.tsx`: compact content hierarchy, note display, inline controls, optimistic priority display, and compact pressure copy.
- Modify `src/features/today/TodayTaskCard.css`: 76–88px target layout, one-line truncation, small controls, responsive rules, and reduced-motion handling.
- Modify `src/features/today/TodayTaskBoard.tsx`: pass priority callbacks and per-task busy state.
- Modify `src/features/today/TodayTaskBoard.test.tsx`: verify notes, direct priority updates, click isolation, compact status treatment, and removal of the large stamp.
- Modify `src/pages/TodayPage.tsx`: save priority through `updateTask`, refresh tasks, and surface failures.
- Modify `src/pages/TodayPage.css`: align loading skeletons with the compact card height.

### Task 1: Accessible Priority Menu

**Files:**
- Create: `src/features/today/TaskPriorityMenu.tsx`
- Create: `src/features/today/TaskPriorityMenu.test.tsx`

- [ ] **Step 1: Write failing menu interaction tests**

```tsx
it("opens all five priority choices and selects a new value", () => {
  const onChange = vi.fn();
  render(<TaskPriorityMenu taskTitle="季度复盘" value={3} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "季度复盘 紧急程度：紧急" }));
  expect(screen.getAllByRole("menuitemradio")).toHaveLength(5);
  fireEvent.click(screen.getByRole("menuitemradio", { name: "非常紧急" }));
  expect(onChange).toHaveBeenCalledWith(5);
});

it("does not emit when the current priority is chosen", () => {
  const onChange = vi.fn();
  render(<TaskPriorityMenu taskTitle="季度复盘" value={3} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: /季度复盘 紧急程度/ }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "紧急" }));
  expect(onChange).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/features/today/TaskPriorityMenu.test.tsx`

Expected: FAIL because `TaskPriorityMenu` does not exist.

- [ ] **Step 3: Implement the menu**

```tsx
export function TaskPriorityMenu({ taskTitle, value, disabled = false, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div className="task-priority-menu" ref={rootRef}>
      <button
        type="button"
        className={`task-priority-menu__trigger ${priorityToneClass(value)}`}
        aria-label={`${taskTitle} 紧急程度：${priorityLabel(value)}`}
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        {priorityLabel(value)}<span aria-hidden="true">⌄</span>
      </button>
      {open ? (
        <div className="task-priority-menu__popover" role="menu" aria-label={`${taskTitle} 紧急程度选项`}>
          {TASK_PRIORITIES.map((option) => (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              key={option.value}
              onClick={() => {
                setOpen(false);
                if (option.value !== value) onChange(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
```

Add Escape dismissal, ArrowUp/ArrowDown focus movement, outside-click dismissal, visible focus styling, and `disabled` protection.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm test -- src/features/today/TaskPriorityMenu.test.tsx`

Expected: PASS.

### Task 2: Compact Card Structure and Note Display

**Files:**
- Modify: `src/features/today/TodayTaskCard.tsx`
- Modify: `src/features/today/TodayTaskCard.css`
- Modify: `src/features/today/TodayTaskBoard.test.tsx`

- [ ] **Step 1: Add failing card behavior tests**

```tsx
it("shows a trimmed note and omits an empty note row", () => {
  const withNote = { ...task("note", "有备注"), note: "  补上留存曲线  " };
  const blankNote = { ...task("blank", "空备注"), note: "   " };
  render(<TodayTaskBoard tasks={{
    formalTasks: [withNote, blankNote],
    upcomingDeadlineTasks: [],
    overdueTasks: [],
    completedTodayTasks: [],
    autoStartedTaskIds: [],
  }} />);
  expect(screen.getByText("补上留存曲线")).toBeTruthy();
  expect(document.querySelectorAll(".today-task-card__note")).toHaveLength(1);
});

it("changes priority without opening task details", () => {
  const onSelect = vi.fn();
  const onPriorityChange = vi.fn();
  render(<TodayTaskBoard tasks={tasks} onSelect={onSelect} onPriorityChange={onPriorityChange} />);
  fireEvent.click(screen.getByRole("button", { name: /马上交稿 紧急程度/ }));
  fireEvent.click(screen.getByRole("menuitemradio", { name: "非常紧急" }));
  expect(onPriorityChange).toHaveBeenCalledWith(tasks.formalTasks[0], 5);
  expect(onSelect).not.toHaveBeenCalled();
});

it("removes the separate management strip and large pressure stamp", () => {
  render(<TodayTaskBoard tasks={tasks} />);
  expect(screen.queryByText("任务管理")).toBeNull();
  expect(document.querySelector(".task-pressure-stamp")).toBeNull();
  expect(screen.getByLabelText(/时间进度/)).toBeTruthy();
});
```

- [ ] **Step 2: Run board tests and verify they fail**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx`

Expected: FAIL on missing note, missing priority control, and the existing management strip.

- [ ] **Step 3: Restructure the card**

Render a compact top row with a title button, `TaskPriorityMenu`, and the existing status control. Render `task.note?.trim()` as `.today-task-card__note`. Keep timing metadata and the thin progress bar below it. Replace `TaskPressureStamp` with an optional `.today-task-card__pressure-copy` derived from `pressure.emotion` and `pressure.percentLabel`; retain overdue duration and compact chaos copy for overdue cards.

The detail buttons must exclude every interactive control. Use this structure, with the existing terminal/read-write status branches rendered inside the action group:

```tsx
<div className="today-task-card__topline">
  <button className="today-task-card__detail" onClick={() => onSelect?.(task.id)}>
    <h3>{task.title}</h3>
  </button>
  <div className="today-task-card__actions">
    <TaskPriorityMenu
      taskTitle={task.title}
      value={displayPriority}
      disabled={priorityBusy || terminal}
      onChange={(priority) => void handlePriorityChange(priority)}
    />
    {terminal ? (
      <span className="today-task-card__terminal-status">{statusLabel(task.status)}</span>
    ) : (
      <select
        aria-label={`${task.title} 主状态`}
        value={task.status}
        disabled={statusBusy}
        onChange={(event) => void onStatusChange?.(task, event.target.value as TaskStatus)}
      >
        {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    )}
  </div>
</div>
{note ? (
  <button className="today-task-card__note" onClick={() => onSelect?.(task.id)}>{note}</button>
) : null}
<div className="today-task-card__timing">
  <FormalTaskTiming task={task} pressure={pressure} />
</div>
```

- [ ] **Step 4: Implement compact CSS**

Use an 8px vertical card padding, a one-line title and note, 22–26px controls, 4px progress bar, and no management border. Keep the priority rail at 5px and sync it with `displayPriority`. At `max-width: 520px`, keep the controls on the top row and allow the title to truncate before moving controls. Preserve visible focus and reduced-motion behavior.

- [ ] **Step 5: Run board and pressure tests**

Run: `npm test -- src/features/today/TodayTaskBoard.test.tsx src/features/today/taskPressure.test.ts`

Expected: PASS.

### Task 3: Priority Persistence and Error Recovery

**Files:**
- Modify: `src/features/today/TodayTaskBoard.tsx`
- Modify: `src/features/today/TodayTaskCard.tsx`
- Modify: `src/pages/TodayPage.tsx`

- [ ] **Step 1: Thread priority props through the board**

Add these props to `TodayTaskBoard`, `TodayTaskList`, and `TodayTaskCard`:

```ts
onPriorityChange?: (task: Task, priority: number) => void | Promise<void>;
priorityBusyTaskId?: string | null;
```

Pass `priorityBusy={priorityBusyTaskId === task.id}` to the matching card.

- [ ] **Step 2: Implement optimistic card display with rollback**

```tsx
const [displayPriority, setDisplayPriority] = useState(task.priority);
useEffect(() => setDisplayPriority(task.priority), [task.priority]);

async function handlePriorityChange(priority: number) {
  const previous = displayPriority;
  setDisplayPriority(priority);
  try {
    await onPriorityChange?.(task, priority);
  } catch {
    setDisplayPriority(previous);
  }
}
```

Use `displayPriority` for both the rail tone and priority trigger.

- [ ] **Step 3: Save priority from TodayPage**

```tsx
const [priorityBusyTaskId, setPriorityBusyTaskId] = useState<string | null>(null);

const handleTaskPriorityChange = useCallback(async (task: Task, priority: number) => {
  if (priority === task.priority || priorityBusyTaskId) return;
  setPriorityBusyTaskId(task.id);
  setTaskActionError(null);
  try {
    await updateTask({ id: task.id, priority });
    await loadTodayTasks();
  } catch (caught) {
    setTaskActionError(mapTaskError(caught as TaskAppError));
    throw caught;
  } finally {
    setPriorityBusyTaskId(null);
  }
}, [loadTodayTasks, priorityBusyTaskId]);
```

Pass the handler and busy id to `TodayTaskBoard`. Keep status and priority busy state independent.

- [ ] **Step 4: Run focused interaction tests**

Run: `npm test -- src/features/today/TaskPriorityMenu.test.tsx src/features/today/TodayTaskBoard.test.tsx`

Expected: PASS with priority callbacks and click isolation covered.

### Task 4: Regression, Layout Verification, and Build

**Files:**
- Modify: `src/pages/TodayPage.css`
- Modify: `src/features/today/TodayTaskCard.css`

- [ ] **Step 1: Match loading skeletons to compact cards**

Set standard skeleton blocks to approximately `5rem` and the short block to `4rem`, keeping the existing shimmer and reduced-motion behavior.

- [ ] **Step 2: Run the full frontend test suite**

Run: `npm test`

Expected: all Vitest suites pass.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: TypeScript compilation and Vite production build both succeed.

- [ ] **Step 4: Visually verify the real page**

Launch the existing app preview, inspect desktop and narrow widths, and confirm: notes are visible; controls never overlap the title; cards do not overflow; priority and status actions do not open the drawer; ordinary formal cards measure approximately 76–88px when no temporary broadcast is present.

- [ ] **Step 5: Commit the implementation**

```bash
git add src/features/today/TaskPriorityMenu.tsx src/features/today/TaskPriorityMenu.test.tsx src/features/today/TodayTaskCard.tsx src/features/today/TodayTaskCard.css src/features/today/TodayTaskBoard.tsx src/features/today/TodayTaskBoard.test.tsx src/pages/TodayPage.tsx src/pages/TodayPage.css
git commit -m "feat: compact today task cards"
```
