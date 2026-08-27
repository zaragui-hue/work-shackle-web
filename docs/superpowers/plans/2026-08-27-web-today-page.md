# Standalone Web Today Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an independent `web/` React application that reproduces the confirmed desktop Today experience while persisting all Web data in a user-selected local folder.

**Architecture:** The new Web application owns its source, tests, styles, domain rules, and persistence code and never imports from or modifies the desktop `src/` or `src-tauri/`. A typed store coordinates pure task/workday calculations with a File System Access adapter; the adapter validates versioned JSON, remembers the directory handle in IndexedDB, and maintains recovery backups.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, Zod, browser File System Access API, IndexedDB, Notification API

---

## File structure

- `web/package.json`, `web/tsconfig*.json`, `web/vite.config.ts`, `web/index.html`: independent build and test tooling.
- `web/src/domain/model.ts`: persisted data and runtime view types.
- `web/src/domain/defaultData.ts`: first-run data matching the confirmed App defaults.
- `web/src/domain/tasks.ts`: task validation, mutation, and Today grouping rules.
- `web/src/domain/workday.ts`: schedule, countdown, lunch, overtime, work-end, and reminder calculations.
- `web/src/storage/directoryHandleStore.ts`: IndexedDB persistence for the selected directory handle.
- `web/src/storage/fileDataStore.ts`: validated main-file reads, writes, backups, migration, and recovery.
- `web/src/app/WebDataProvider.tsx`: application state, serialized writes, unsaved-state handling, and actions.
- `web/src/app/StartupGate.tsx`: compatibility, folder selection, permission recovery, and corrupt-file recovery UI.
- `web/src/features/tasks/*`: Today task board, task cards, task editor, and postpone dialog.
- `web/src/features/today/*`: status cockpit, schedule tools, reminders, lunch, overtime, work-end, and countdown UI.
- `web/src/shared/*`: buttons, cards, modal/drawer primitives, mascot assets, and shell styling owned by Web.
- `web/src/App.tsx`, `web/src/main.tsx`: one-page Web entry point.

### Task 1: Scaffold the independent Web application

**Files:**
- Create: `web/package.json`
- Create: `web/tsconfig.json`
- Create: `web/tsconfig.app.json`
- Create: `web/tsconfig.node.json`
- Create: `web/vite.config.ts`
- Create: `web/index.html`
- Create: `web/src/main.tsx`
- Create: `web/src/App.tsx`
- Create: `web/src/test/setup.ts`
- Test: `web/src/App.test.tsx`

- [ ] **Step 1: Write the failing shell test**

```tsx
render(<App />);
expect(screen.getByRole("heading", { name: "精神状态事务所" })).toBeVisible();
expect(screen.queryByRole("button", { name: "任务现场" })).not.toBeInTheDocument();
expect(screen.queryByRole("button", { name: "生存设置" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run the test and verify the Web project is not yet runnable**

Run: `npm --prefix web test -- --run src/App.test.tsx`

Expected: FAIL because the independent Web package and entry files do not exist.

- [ ] **Step 3: Add the independent Vite package and minimal shell**

```json
{
  "name": "work-shackle-web",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@hookform/resolvers": "^5.8.0",
    "date-fns": "^4.4.0",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "react-hook-form": "^7.85.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.8.0",
    "@testing-library/react": "^16.3.0",
    "@types/react": "^19.1.8",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.6.0",
    "jsdom": "^26.1.0",
    "typescript": "~5.8.3",
    "vite": "^7.0.4",
    "vitest": "^3.2.4"
  }
}
```

Implement `App` with only the brand heading and Today navigation state. Do not import any path outside `web/`.

- [ ] **Step 4: Install dependencies and run the shell test**

Run: `npm --prefix web install`

Expected: a Web-owned `package-lock.json` is created.

Run: `npm --prefix web test -- --run src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the scaffold**

```bash
git add web
git commit -m "feat(web): scaffold standalone today app"
```

### Task 2: Define and validate the versioned local data model

**Files:**
- Create: `web/src/domain/model.ts`
- Create: `web/src/domain/defaultData.ts`
- Test: `web/src/domain/model.test.ts`
- Test: `web/src/domain/defaultData.test.ts`

- [ ] **Step 1: Write failing schema and defaults tests**

```ts
expect(WebDataSchema.parse(createDefaultWebData(1_787_824_000_000))).toMatchObject({
  schemaVersion: 1,
  tasks: [],
  overtimeRecords: [],
});
expect(() => WebDataSchema.parse({ schemaVersion: 1, tasks: "bad" })).toThrow();
```

- [ ] **Step 2: Verify the tests fail**

Run: `npm --prefix web test -- --run src/domain/model.test.ts src/domain/defaultData.test.ts`

Expected: FAIL because the schema and default factory are missing.

- [ ] **Step 3: Implement focused persisted types and schema**

```ts
export const TaskStatusSchema = z.enum([
  "not_started", "in_progress", "paused", "waiting", "completed", "cancelled",
]);
export const WebDataSchema = z.object({
  schemaVersion: z.literal(1),
  updatedAtMs: z.number().int().nonnegative(),
  tasks: z.array(TaskSchema),
  taskReminders: z.array(TaskReminderSchema),
  postponements: z.array(TaskPostponementSchema),
  schedule: ScheduleSchema,
  workdayReminders: z.array(WorkdayReminderSchema),
  workStatusRecords: z.array(WorkStatusRecordSchema),
  lunchReminderLog: z.array(DailyEventSchema),
  overtimeRecords: z.array(OvertimeRecordSchema),
  workEndDecisions: z.array(WorkEndDecisionSchema),
});
export type WebData = z.infer<typeof WebDataSchema>;
```

Define every referenced schema in `model.ts`; use epoch milliseconds for instants and `YYYY-MM-DD` for work dates. Add defaults matching the desktop migration seed values and current workday reminder defaults.

- [ ] **Step 4: Run domain model tests**

Run: `npm --prefix web test -- --run src/domain/model.test.ts src/domain/defaultData.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the model**

```bash
git add web/src/domain
git commit -m "feat(web): define local data model"
```

### Task 3: Add directory permission and durable file persistence

**Files:**
- Create: `web/src/storage/directoryHandleStore.ts`
- Create: `web/src/storage/fileDataStore.ts`
- Create: `web/src/storage/storageErrors.ts`
- Test: `web/src/storage/fileDataStore.test.ts`
- Test: `web/src/storage/directoryHandleStore.test.ts`

- [ ] **Step 1: Write failing persistence tests with in-memory directory handles**

```ts
const store = new FileDataStore(fakeDirectory);
await store.initialize(now);
await store.save({ ...createDefaultWebData(now), updatedAtMs: now + 1 });
expect(await fakeDirectory.readJson("work-shackle-web.json")).toMatchObject({ updatedAtMs: now + 1 });
expect(await fakeDirectory.readJson("work-shackle-web.backup.json")).toMatchObject({ updatedAtMs: now });
```

Add cases for corrupt primary data, a future schema version, daily backup creation, retention of the newest 30 dated backups, write failure, and refusal to replace an existing invalid file.

- [ ] **Step 2: Verify persistence tests fail**

Run: `npm --prefix web test -- --run src/storage`

Expected: FAIL because the persistence adapters are missing.

- [ ] **Step 3: Implement IndexedDB handle storage and file operations**

```ts
export interface DirectoryHandleRepository {
  load(): Promise<FileSystemDirectoryHandle | null>;
  save(handle: FileSystemDirectoryHandle): Promise<void>;
  clear(): Promise<void>;
}

export class FileDataStore {
  constructor(private readonly directory: FileSystemDirectoryHandle) {}
  initialize(nowMs: number): Promise<WebData>;
  load(): Promise<WebData>;
  save(next: WebData, nowMs?: number): Promise<void>;
  restore(source: "previous" | string): Promise<WebData>;
  listBackups(): Promise<BackupDescriptor[]>;
}
```

Use `queryPermission`/`requestPermission` for `readwrite`, `createWritable()` for files, `getDirectoryHandle("backups", { create: true })` for daily snapshots, and `WebDataSchema.safeParse` before every write. Throw typed errors: `unsupported`, `permission-denied`, `invalid-data`, `future-version`, `read-failed`, and `write-failed`.

- [ ] **Step 4: Run persistence tests**

Run: `npm --prefix web test -- --run src/storage`

Expected: PASS.

- [ ] **Step 5: Commit persistence**

```bash
git add web/src/storage
git commit -m "feat(web): persist data in selected folder"
```

### Task 4: Implement Today task rules and mutations

**Files:**
- Create: `web/src/domain/tasks.ts`
- Test: `web/src/domain/tasks.test.ts`

- [ ] **Step 1: Write failing task behavior tests**

```ts
const created = createTask(data, {
  title: "准备评审材料",
  plannedAtMs: todayAt("09:00"),
  deadlineAtMs: todayAt("18:00"),
  priority: 2,
}, now);
expect(queryTodayTasks(created.data, now).formalTasks[0]?.id).toBe(created.task.id);
expect(completeTask(created.data, created.task.id, now).task.status).toBe("completed");
```

Add explicit tests for invalid deadlines, maximum three reminders, automatic start at planned time, overdue grouping without duplication, cancellation history, postponement history, editing, and priority changes.

- [ ] **Step 2: Verify task tests fail**

Run: `npm --prefix web test -- --run src/domain/tasks.test.ts`

Expected: FAIL because task rules are missing.

- [ ] **Step 3: Implement pure immutable task operations**

```ts
export function createTask(data: WebData, input: CreateTaskInput, nowMs: number): MutationResult<Task>;
export function updateTask(data: WebData, input: UpdateTaskInput, nowMs: number): MutationResult<Task>;
export function changeTaskStatus(data: WebData, id: string, status: TaskStatus, nowMs: number): MutationResult<Task>;
export function postponeTask(data: WebData, input: PostponeTaskInput, nowMs: number): MutationResult<Task>;
export function autoStartTasks(data: WebData, nowMs: number): MutationResult<string[]>;
export function queryTodayTasks(data: WebData, nowMs: number): TodayTasks;
```

Generate IDs with `crypto.randomUUID()`, normalize optional strings, validate inputs with Zod, and return new data objects rather than mutating arguments.

- [ ] **Step 4: Run task tests**

Run: `npm --prefix web test -- --run src/domain/tasks.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit task rules**

```bash
git add web/src/domain/tasks.ts web/src/domain/tasks.test.ts
git commit -m "feat(web): add today task rules"
```

### Task 5: Implement workday calculations and mutations

**Files:**
- Create: `web/src/domain/workday.ts`
- Test: `web/src/domain/workday.test.ts`

- [ ] **Step 1: Write failing deterministic workday tests**

```ts
expect(getCountdown(data, at("2026-08-27T10:00:00+08:00"))).toMatchObject({ phase: "working" });
expect(startOvertime(data, at("2026-08-27T18:01:00+08:00")).record.endAtMs).toBeUndefined();
expect(getDueWorkdayReminders(data, at("2026-08-27T12:00:00+08:00"))).toHaveLength(1);
```

Add cases for before work, working, lunch, after work, normal off-work, active/ended overtime, dismissed lunch prompt, reminder deduplication, status switching, today end-time override, and local midnight rollover.

- [ ] **Step 2: Verify workday tests fail**

Run: `npm --prefix web test -- --run src/domain/workday.test.ts`

Expected: FAIL because workday rules are missing.

- [ ] **Step 3: Implement pure time-dependent functions**

```ts
export function getWorkSchedule(data: WebData, nowMs: number): EffectiveSchedule;
export function getCountdown(data: WebData, nowMs: number): CountdownDisplay;
export function switchWorkStatus(data: WebData, statusType: WorkStatusType, nowMs: number): MutationResult<CurrentWorkStatus>;
export function getLunchReminder(data: WebData, nowMs: number): LunchReminder | null;
export function startOvertime(data: WebData, nowMs: number): MutationResult<OvertimeRecord>;
export function endOvertime(data: WebData, nowMs: number): MutationResult<OvertimeRecord>;
export function confirmNormalOffWork(data: WebData, nowMs: number): MutationResult<WorkEndDecision>;
export function getDueWorkdayReminders(data: WebData, nowMs: number): WorkdayReminder[];
```

Accept `nowMs` in every time-dependent function so tests do not depend on the system clock. Preserve all historical records and deduplicate fired reminders by date and reminder ID.

- [ ] **Step 4: Run workday tests**

Run: `npm --prefix web test -- --run src/domain/workday.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit workday rules**

```bash
git add web/src/domain/workday.ts web/src/domain/workday.test.ts
git commit -m "feat(web): add workday automation rules"
```

### Task 6: Build the application data provider and startup/recovery gate

**Files:**
- Create: `web/src/app/WebDataProvider.tsx`
- Create: `web/src/app/useWebData.ts`
- Create: `web/src/app/StartupGate.tsx`
- Create: `web/src/app/StartupGate.css`
- Test: `web/src/app/WebDataProvider.test.tsx`
- Test: `web/src/app/StartupGate.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing provider and startup tests**

```tsx
render(<StartupGate storeFactory={storeFactory} />);
await user.click(screen.getByRole("button", { name: "选择数据文件夹" }));
expect(await screen.findByText("今日作战台")).toBeVisible();
expect(storeFactory.current.load).toHaveBeenCalledTimes(1);
```

Add tests for unsupported browser, permission renewal, existing valid file, invalid file read-only recovery, future-version refusal, failed save with unsaved badge, retry success, and restoring a selected backup.

- [ ] **Step 2: Verify provider tests fail**

Run: `npm --prefix web test -- --run src/app`

Expected: FAIL because provider and startup UI are missing.

- [ ] **Step 3: Implement serialized persistence and recovery states**

```ts
export type StartupState =
  | { kind: "checking" }
  | { kind: "needs-directory" }
  | { kind: "needs-permission"; handle: FileSystemDirectoryHandle }
  | { kind: "ready"; data: WebData }
  | { kind: "recovery"; error: StorageError; backups: BackupDescriptor[] }
  | { kind: "unsupported" };
```

Expose task and workday actions from `WebDataProvider`. Queue writes so two quick actions cannot overwrite each other. Track `saved`, `saving`, and `unsaved` states, retaining the latest in-memory data until retry succeeds.

- [ ] **Step 4: Run startup/provider tests**

Run: `npm --prefix web test -- --run src/app`

Expected: PASS.

- [ ] **Step 5: Commit startup flow**

```bash
git add web/src/app web/src/App.tsx
git commit -m "feat(web): add folder startup and recovery"
```

### Task 7: Build Today task interactions

**Files:**
- Create: `web/src/features/tasks/TodayTaskBoard.tsx`
- Create: `web/src/features/tasks/TodayTaskCard.tsx`
- Create: `web/src/features/tasks/TaskDrawer.tsx`
- Create: `web/src/features/tasks/TaskForm.tsx`
- Create: `web/src/features/tasks/PostponeTaskModal.tsx`
- Create: `web/src/features/tasks/tasks.css`
- Test: `web/src/features/tasks/TodayTaskBoard.test.tsx`
- Test: `web/src/features/tasks/TaskDrawer.test.tsx`

- [ ] **Step 1: Write failing task UI tests**

```tsx
render(<TodayTaskBoard />);
await user.click(screen.getByRole("button", { name: "新建任务" }));
await user.type(screen.getByLabelText("任务标题"), "准备周报");
await user.click(screen.getByRole("button", { name: "保存任务" }));
expect(await screen.findByText("准备周报")).toBeVisible();
```

Add UI tests for edit, complete, cancel confirmation, postpone reason/deadline, priority menu, completed-section expansion, overdue grouping, validation messages, and save failure visibility.

- [ ] **Step 2: Verify task UI tests fail**

Run: `npm --prefix web test -- --run src/features/tasks`

Expected: FAIL because task components are missing.

- [ ] **Step 3: Implement the complete Today task UI**

Use accessible buttons, labels, dialog semantics, keyboard close behavior, and focus return. Keep the existing Chinese product voice and the four visible task group behaviors. Connect every mutation to `useWebData()` rather than importing storage directly.

```tsx
<TodayTaskBoard
  tasks={todayTasks}
  onCreate={() => setCreateOpen(true)}
  onSelect={setSelectedTaskId}
  onStatusChange={actions.changeTaskStatus}
  onPriorityChange={actions.changeTaskPriority}
  onPostpone={setPostponingTask}
/>
```

- [ ] **Step 4: Run task UI tests**

Run: `npm --prefix web test -- --run src/features/tasks`

Expected: PASS.

- [ ] **Step 5: Commit task UI**

```bash
git add web/src/features/tasks
git commit -m "feat(web): build today task interactions"
```

### Task 8: Build the status cockpit and workday controls

**Files:**
- Create: `web/src/features/today/StatusCockpit.tsx`
- Create: `web/src/features/today/WorkCountdown.tsx`
- Create: `web/src/features/today/WorkStatusControl.tsx`
- Create: `web/src/features/today/WorkScheduleEditor.tsx`
- Create: `web/src/features/today/WorkdayReminderEditor.tsx`
- Create: `web/src/features/today/LunchBanner.tsx`
- Create: `web/src/features/today/WorkEndBanner.tsx`
- Create: `web/src/features/today/OvertimeBanner.tsx`
- Create: `web/src/features/today/useTodayClock.ts`
- Create: `web/src/features/today/today.css`
- Test: `web/src/features/today/TodayControls.test.tsx`

- [ ] **Step 1: Write failing control tests with a fake clock**

```tsx
vi.setSystemTime(new Date("2026-08-27T17:30:00+08:00"));
render(<StatusCockpit />);
expect(screen.getByText(/距离下班/)).toBeVisible();
await user.selectOptions(screen.getByLabelText("当前状态"), "lunch");
expect(screen.getByText(/午休/)).toBeVisible();
```

Add tests for changing end time, adding/editing/disabling a reminder, lunch dismissal and status switch, normal off-work confirmation, overtime start/end, and midnight refresh.

- [ ] **Step 2: Verify Today control tests fail**

Run: `npm --prefix web test -- --run src/features/today`

Expected: FAIL because Today controls are missing.

- [ ] **Step 3: Implement controls backed only by provider actions**

The clock hook ticks every second for display and every 30 seconds for automation checks, pauses timers on unmount, and forces a data recomputation when the local date changes. Keep schedule editing on the Today page because no Settings page exists.

```ts
useEffect(() => {
  const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
  return () => window.clearInterval(timer);
}, []);
```

- [ ] **Step 4: Run Today control tests**

Run: `npm --prefix web test -- --run src/features/today`

Expected: PASS.

- [ ] **Step 5: Commit Today controls**

```bash
git add web/src/features/today
git commit -m "feat(web): build workday cockpit"
```

### Task 9: Add browser notifications, backup actions, and the final page shell

**Files:**
- Create: `web/src/browser/notifications.ts`
- Create: `web/src/browser/downloadBackup.ts`
- Create: `web/src/shared/ui.tsx`
- Create: `web/src/shared/shell.css`
- Create: `web/src/shared/mascot.tsx`
- Add: `web/src/assets/mascot/*`
- Create: `web/src/pages/TodayPage.tsx`
- Create: `web/src/pages/TodayPage.css`
- Test: `web/src/browser/notifications.test.ts`
- Test: `web/src/pages/TodayPage.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing notification and assembled-page tests**

```ts
await notify({ title: "该切换状态了", body: "起来活动一下" });
expect(Notification).toHaveBeenCalledWith("该切换状态了", { body: "起来活动一下" });
```

```tsx
render(<TodayPage />);
expect(screen.getByRole("heading", { name: "精神状态事务所" })).toBeVisible();
expect(screen.getByRole("button", { name: "立即备份" })).toBeVisible();
expect(screen.queryByText("任务现场")).not.toBeInTheDocument();
```

Add cases for denied notification permission, page-visible fallback banners, backup download naming, unsaved badge, and viewports below 1024px.

- [ ] **Step 2: Verify browser/page tests fail**

Run: `npm --prefix web test -- --run src/browser src/pages`

Expected: FAIL because the browser adapters and assembled page are missing.

- [ ] **Step 3: Assemble the independent page and Web-owned visual assets**

Copy only the confirmed current visual appearance into Web-owned CSS and mascot assets. Do not reference files under root `src/`. Request notification permission only from an explicit user click and always render an in-page reminder if permission is unavailable.

```ts
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!("Notification" in window)) return "denied";
  return Notification.requestPermission();
}
```

Use `Blob` plus a temporary object URL for the manual backup download and revoke the URL after the click.

- [ ] **Step 4: Run browser/page tests and the full Web suite**

Run: `npm --prefix web test`

Expected: all Web tests PASS.

- [ ] **Step 5: Commit the assembled page**

```bash
git add web/src
git commit -m "feat(web): assemble standalone today page"
```

### Task 10: Verify build, isolation, and browser behavior

**Files:**
- Create: `web/README.md`
- Create: `web/scripts/check-isolation.mjs`
- Modify: `web/package.json`

- [ ] **Step 1: Add an isolation check that fails on cross-project imports**

```js
const forbidden = /from\s+["'](?:\.\.\/){2,}(?:src|src-tauri)\//;
if (files.some(({ contents }) => forbidden.test(contents))) {
  process.stderr.write("Web source imports desktop source\n");
  process.exit(1);
}
```

Add `"check:isolation": "node scripts/check-isolation.mjs"` and document Chrome/Edge support, local-folder setup, notification limits, backup recovery, development, test, and build commands.

- [ ] **Step 2: Run all automated verification**

Run: `npm --prefix web run check:isolation`

Expected: PASS with no imports from root `src/` or `src-tauri/`.

Run: `npm --prefix web test`

Expected: all tests PASS.

Run: `npm --prefix web run build`

Expected: TypeScript and Vite build successfully and create `web/dist/`.

Run: `git diff 427cf96 --name-only -- src src-tauri`

Expected: no output, proving desktop App files were not modified after the design commit.

- [ ] **Step 3: Perform browser acceptance checks**

Run: `npm --prefix web run dev -- --host 127.0.0.1`

In current Chrome and Edge, verify selecting a folder, creating/editing/completing/postponing a task, changing status/end time, lunch, normal off-work, overtime, reminder permission, refresh recovery, browser restart recovery, manual backup, corrupt-main recovery, and the under-1024px warning.

Expected: every operation updates `work-shackle-web.json`; previous and daily backups exist; reopening preserves history; App behavior and files are unchanged.

- [ ] **Step 4: Commit documentation and verification**

```bash
git add web/README.md web/scripts/check-isolation.mjs web/package.json web/package-lock.json
git commit -m "docs(web): add usage and isolation checks"
```
