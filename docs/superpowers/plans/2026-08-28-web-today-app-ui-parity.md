# Web Today App UI Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the standalone Web today page with the current desktop App visual structure while preserving browser-folder persistence and every existing Web today-page behavior.

**Architecture:** Keep the Web domain and storage layers unchanged. Split the current monolithic `web/src/App.tsx` presentation into Web-owned shell, today, task, and startup components that receive calculated data and callbacks; reproduce the App design with copied local assets and Web-local CSS, without importing anything from desktop `src/`.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, File System Access API, CSS custom properties.

---

## File structure

- `web/src/App.tsx`: startup state, Web data orchestration, clock/reminder effects, save queue, and composition only.
- `web/src/ui/AppHeader.tsx`: App-style brand header, live status, three-tab navigation, and unavailable-page notice trigger.
- `web/src/ui/StartupPanel.tsx`: App-style Web folder selection, compatibility, and recovery states.
- `web/src/features/today/TodayCockpit.tsx`: countdown stage, work status select, work-end decision, overtime state, and horse progress.
- `web/src/features/today/TodayTaskBoard.tsx`: today task groups, ticket-style task cards, completion/priority/postpone/edit callbacks.
- `web/src/features/today/WorkdayTools.tsx`: today end-time control, reminders editor, Web save state, backup, notification permission, and retry save.
- `web/src/features/tasks/WebTaskDrawer.tsx`: App-style create/edit task drawer using the existing Web task input contract.
- `web/src/features/tasks/WebPostponeDialog.tsx`: App-style postpone modal.
- `web/src/styles/tokens.css`: Web-local copy of the confirmed App color, spacing, type, radius, border, and shadow tokens.
- `web/src/styles.css`: imports and page-level responsive composition.
- Component-local `.css` files: styles owned by each component.
- `web/src/assets/workhorse/`: copied Web-owned horse image files; no imports from desktop `src/`.

### Task 1: Establish the Web-local App design foundation

**Files:**
- Create: `web/src/styles/tokens.css`
- Create: `web/src/styles/base.css`
- Create: `web/src/ui/StartupPanel.tsx`
- Create: `web/src/ui/StartupPanel.css`
- Modify: `web/src/styles.css`
- Modify: `web/src/App.tsx`
- Test: `web/src/App.test.tsx`

- [ ] **Step 1: Add a failing startup visual-contract test**

```tsx
it("uses the App brand on the unsupported-browser screen", async () => {
  render(<App />);
  expect(await screen.findByRole("heading", { name: "当前浏览器不支持本地文件夹" })).toBeVisible();
  expect(screen.getByText("精神状态事务所")).toBeVisible();
  expect(screen.getByText("OFFICE SURVIVAL SYSTEM")).toBeVisible();
  expect(screen.queryByText("任务现场")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the startup test and verify it fails**

Run: `npm test -- App.test.tsx`

Expected: FAIL because the existing startup card does not render the App brand lockup.

- [ ] **Step 3: Add App-matching tokens and startup component**

Define the exact confirmed token roles in `tokens.css`:

```css
:root {
  --color-ink: #111318;
  --color-paper: #efede5;
  --color-paper-raised: #fbfaf5;
  --color-stage: #111318;
  --color-anchor: #345cff;
  --color-signal: #cfff24;
  --color-danger: #ff4b2e;
  --color-ink-muted: #74736d;
  --font-data: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  --border-ink-strong: 2px solid var(--color-ink);
  --radius-shell: 12px;
  --radius-card: 8px;
  --shadow-soft: 8px 8px 0 color-mix(in srgb, var(--color-ink) 18%, transparent);
}
```

Create `StartupPanel` with `title`, `copy`, optional actions, and danger tone. Render the yellow App brand band, round `WS` mark, `精神状态事务所`, `OFFICE SURVIVAL SYSTEM`, and a Web-local storage label. Replace `CenteredPanel` calls in `App.tsx` with `StartupPanel` without changing startup branching or file APIs.

- [ ] **Step 4: Run the startup test and full test suite**

Run: `npm test -- App.test.tsx && npm test`

Expected: startup test and all existing Web tests PASS.

- [ ] **Step 5: Commit the foundation**

```bash
git add web/src/styles web/src/ui/StartupPanel.tsx web/src/ui/StartupPanel.css web/src/styles.css web/src/App.tsx web/src/App.test.tsx
git commit -m "feat(web): align startup with app design"
```

### Task 2: Rebuild the App header and three-tab navigation

**Files:**
- Create: `web/src/ui/AppHeader.tsx`
- Create: `web/src/ui/AppHeader.css`
- Create: `web/src/ui/AppHeader.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing navigation tests**

```tsx
it("keeps today active and reports unavailable Web tabs", async () => {
  const user = userEvent.setup();
  render(<AppHeader statusName="埋头干活" statusEmoji="💻" onUnavailable={vi.fn()} />);
  expect(screen.getByRole("button", { name: "今日状态" })).toHaveAttribute("aria-current", "page");
  await user.click(screen.getByRole("button", { name: "任务现场" }));
  expect(onUnavailable).toHaveBeenCalledWith("任务");
  await user.click(screen.getByRole("button", { name: "生存设置" }));
  expect(onUnavailable).toHaveBeenCalledWith("设置");
});
```

Use a declared `const onUnavailable = vi.fn()` variable before render so the assertions share the same mock.

- [ ] **Step 2: Run the navigation test and verify it fails**

Run: `npm test -- AppHeader.test.tsx`

Expected: FAIL because `AppHeader` does not exist.

- [ ] **Step 3: Implement the independent Web header**

Create `AppHeader` with the App class structure (`ws-shell__brand`, `ws-shell__brand-lockup`, `ws-shell__live`, `ws-shell__nav`). Define three buttons with labels `今日状态`, `任务现场`, and `生存设置`; only today receives `aria-current="page"`. The other two call `onUnavailable("任务")` or `onUnavailable("设置")` and never change selected state.

In `TodayApp`, add:

```tsx
const [unavailablePage, setUnavailablePage] = useState<"任务" | "设置" | null>(null);
```

Render one dismissible notice after the header:

```tsx
{unavailablePage ? (
  <div className="ws-notice" role="status">
    <strong>{unavailablePage}页面</strong>
    <span>Web 端暂未开放，当前仍停留在今日页面。</span>
    <button onClick={() => setUnavailablePage(null)}>知道了</button>
  </div>
) : null}
```

- [ ] **Step 4: Run header and regression tests**

Run: `npm test -- AppHeader.test.tsx App.test.tsx && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit the header**

```bash
git add web/src/ui/AppHeader.tsx web/src/ui/AppHeader.css web/src/ui/AppHeader.test.tsx web/src/App.tsx
git commit -m "feat(web): add app style navigation header"
```

### Task 3: Reproduce the App countdown stage with local horse art

**Files:**
- Create: `web/src/features/today/TodayCockpit.tsx`
- Create: `web/src/features/today/TodayCockpit.css`
- Create: `web/src/features/today/TodayCockpit.test.tsx`
- Create: `web/src/features/today/todayPresentation.ts`
- Create: `web/src/features/today/todayPresentation.test.ts`
- Create: `web/src/assets/workhorse/workhorse-running-clear-v1.png`
- Create: `web/src/assets/workhorse/reactions/professional-smile-v2.png`
- Create: `web/src/assets/workhorse/reactions/overtime-stone-v2.png`
- Create: `web/src/assets/workhorse/reactions/power-down-v1.png`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing presentation tests**

```ts
expect(countdownHeadline("before_start", 0)).toBe("离开工还有");
expect(countdownHeadline("working", 0.52)).toBe("已经熬过一半，别在这时散架");
expect(countdownHeadline("after_end", 1, true, false)).toBe("正在加班");
expect(countdownHeadline("after_end", 1, false, true)).toBe("今天已经下班");
```

Add a component test asserting the rendered countdown, schedule text, status selector, and an `img` with accessible name `正在工位奔跑的马`.

- [ ] **Step 2: Run the new tests and verify they fail**

Run: `npm test -- todayPresentation.test.ts TodayCockpit.test.tsx`

Expected: FAIL because the presentation selector and component do not exist.

- [ ] **Step 3: Copy only approved horse assets into Web**

Copy the four listed images from `src/assets/mascot/workhorse/` into `web/src/assets/workhorse/`. Keep them as independent files so `web/scripts/check-isolation.mjs` continues to reject desktop-source imports.

- [ ] **Step 4: Implement the stage and decision cards**

Move countdown formatting into `todayPresentation.ts`. Add a pure `workdayProgress(schedule, nowMs)` helper that converts the effective schedule start/end clocks to a clamped `0..1` value. `TodayCockpit` receives schedule, countdown phase/remaining, the calculated progress, current status, overtime, work-end decision, and callbacks. Render the App-style dark stage with the countdown as the largest text, a progress track, local horse image, start/end labels, and current-status select. Render normal-off/overtime controls beneath the stage with existing Web callbacks.

Keep domain calculations in `workday.ts`; do not duplicate `countdown`, `effectiveSchedule`, `confirmNormalOff`, `startOvertime`, or `endOvertime`.

- [ ] **Step 5: Run component, domain, and isolation checks**

Run: `npm test -- todayPresentation.test.ts TodayCockpit.test.tsx && npm test && npm run check:isolation`

Expected: all tests PASS and isolation reports no imports from desktop code.

- [ ] **Step 6: Commit the stage**

```bash
git add web/src/features/today web/src/assets/workhorse web/src/App.tsx
git commit -m "feat(web): match app today countdown stage"
```

### Task 4: Rebuild the today task board and ticket cards

**Files:**
- Create: `web/src/features/today/TodayTaskBoard.tsx`
- Create: `web/src/features/today/TodayTaskBoard.css`
- Create: `web/src/features/today/TodayTaskBoard.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing task-board interaction tests**

```tsx
it("keeps the new-task entry and forwards task actions", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn();
  render(<TodayTaskBoard today={todayFixture} nowMs={now} onCreate={onCreate} {...actionMocks} />);
  await user.click(screen.getByRole("button", { name: /新建任务/ }));
  expect(onCreate).toHaveBeenCalledOnce();
  expect(screen.getByText("正在发生")).toBeVisible();
  expect(screen.getByText("昨日烂尾现场")).toBeVisible();
});
```

Add assertions for edit, complete, postpone, cancel, and priority callbacks using a fixed `TodayTasks` fixture.

- [ ] **Step 2: Run the task-board test and verify it fails**

Run: `npm test -- TodayTaskBoard.test.tsx`

Expected: FAIL because the extracted task board does not exist.

- [ ] **Step 3: Implement App-style sections and task cards**

Create focused `TaskSection` and `TaskCard` functions in the same file. Preserve the Web actions and status rules. Use the App labels and hierarchy: `今天这些破事`, `昨日烂尾现场`, `今日清单`, ticket number/time metadata, priority mark, DDL progress, status select, and `申请延期` action. Terminal tasks render read-only status rather than invalid actions.

Move no domain logic out of `domain/tasks.ts`; compute only display progress and labels in the component.

- [ ] **Step 4: Run task-board and domain regression tests**

Run: `npm test -- TodayTaskBoard.test.tsx domain/tasks.test.ts && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit the task board**

```bash
git add web/src/features/today/TodayTaskBoard.tsx web/src/features/today/TodayTaskBoard.css web/src/features/today/TodayTaskBoard.test.tsx web/src/App.tsx
git commit -m "feat(web): match app today task board"
```

### Task 5: Move Web controls and save state into the App-style right column

**Files:**
- Create: `web/src/features/today/WorkdayTools.tsx`
- Create: `web/src/features/today/WorkdayTools.css`
- Create: `web/src/features/today/WorkdayTools.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing right-column tests**

```tsx
it("shows Web persistence state in the workday tools instead of the header", async () => {
  render(<WorkdayTools saveState="saved" saveError="" {...toolProps} />);
  expect(screen.getByText("已保存到本地文件夹")).toBeVisible();
  expect(screen.getByRole("button", { name: "立即备份" })).toBeVisible();
});

it("offers retry when the current data is unsaved", async () => {
  render(<WorkdayTools saveState="unsaved" saveError="写入失败" {...toolProps} />);
  expect(screen.getByText("写入失败")).toBeVisible();
  expect(screen.getByRole("button", { name: "重试保存" })).toBeVisible();
});
```

- [ ] **Step 2: Run the right-column tests and verify they fail**

Run: `npm test -- WorkdayTools.test.tsx`

Expected: FAIL because `WorkdayTools` does not exist.

- [ ] **Step 3: Implement the workday tools component**

Move today end-time input and reminder editor from `App.tsx` into `WorkdayTools`. Add App-style `工位使用证` / `工位小闹钟` cards. At the bottom render:

```tsx
<div className={`local-save local-save--${saveState}`} role="status">
  <strong>{saveState === "saved" ? "已保存到本地文件夹" : saveState === "saving" ? "正在保存" : "尚未保存"}</strong>
  {saveError ? <p>{saveError}</p> : null}
</div>
```

Keep `立即备份`, notification permission, and retry buttons in this Web-only footer. Remove the old header save pill and page-top save error banner.

- [ ] **Step 4: Run tools and storage regression tests**

Run: `npm test -- WorkdayTools.test.tsx storage/fileDataStore.test.ts && npm test`

Expected: all tests PASS.

- [ ] **Step 5: Commit the right column**

```bash
git add web/src/features/today/WorkdayTools.tsx web/src/features/today/WorkdayTools.css web/src/features/today/WorkdayTools.test.tsx web/src/App.tsx
git commit -m "feat(web): align workday tools and save status"
```

### Task 6: Replace task dialogs with App-style drawer and modal

**Files:**
- Create: `web/src/features/tasks/WebTaskDrawer.tsx`
- Create: `web/src/features/tasks/WebTaskDrawer.css`
- Create: `web/src/features/tasks/WebTaskDrawer.test.tsx`
- Create: `web/src/features/tasks/WebPostponeDialog.tsx`
- Create: `web/src/features/tasks/WebPostponeDialog.css`
- Create: `web/src/features/tasks/WebPostponeDialog.test.tsx`
- Modify: `web/src/App.tsx`

- [ ] **Step 1: Write failing drawer and postpone tests**

```tsx
it("creates a task from the right-side drawer", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn();
  render(<WebTaskDrawer mode="create" data={fixtureData} onClose={vi.fn()} onSave={onSave} />);
  await user.type(screen.getByLabelText("任务名称"), "准备周会");
  await user.click(screen.getByRole("button", { name: "保存任务" }));
  expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "准备周会" }));
});
```

Add a postpone test that fills `新 DDL` and `延期原因`, clicks `确认延期`, and verifies the callback receives a valid timestamp and reason.

- [ ] **Step 2: Run drawer tests and verify they fail**

Run: `npm test -- WebTaskDrawer.test.tsx WebPostponeDialog.test.tsx`

Expected: FAIL because the new components do not exist.

- [ ] **Step 3: Implement the drawer without changing the input contract**

Move the existing `TaskDialog` form state and validation into `WebTaskDrawer`. Render an App-style right-side backdrop and drawer with title, close button, scrollable body, the same fields and reminder rows, and a fixed action footer. Continue returning the existing `TaskInput` shape; do not rename stored fields.

- [ ] **Step 4: Implement the postpone modal**

Move existing postpone state into `WebPostponeDialog`, retaining the same default deadline and `onSave(deadlineMs, reason)` contract. Use the App modal border, paper background, overlay, and action styles.

- [ ] **Step 5: Run form, task-domain, and full tests**

Run: `npm test -- WebTaskDrawer.test.tsx WebPostponeDialog.test.tsx domain/tasks.test.ts && npm test`

Expected: all tests PASS.

- [ ] **Step 6: Commit the forms**

```bash
git add web/src/features/tasks web/src/App.tsx
git commit -m "feat(web): match app task drawer and postpone modal"
```

### Task 7: Integrate responsive layout, verify history compatibility, and publish

**Files:**
- Modify: `web/src/styles.css`
- Modify: `web/src/App.tsx`
- Modify: `web/src/App.test.tsx`
- Modify: `web/README.md`

- [ ] **Step 1: Add the final integration test**

Render the `?preview=today` route and assert the visible contract:

```tsx
expect(screen.getByText("精神状态事务所")).toBeVisible();
expect(screen.getByRole("button", { name: "今日状态" })).toHaveAttribute("aria-current", "page");
expect(screen.getByRole("button", { name: /新建任务/ })).toBeVisible();
expect(screen.getByText("工位控制台")).toBeVisible();
expect(screen.getByText("已保存到本地文件夹")).toBeVisible();
```

- [ ] **Step 2: Complete page composition and responsive CSS**

Use a `ws-shell` container capped at 1260px with a 24px desktop margin. Keep the stage full width, then a left task/right tools grid. At 760px switch to a single column; do not add a phone-specific navigation or remove any desktop capability. Add `prefers-reduced-motion` overrides for horse, progress, and notice transitions.

- [ ] **Step 3: Document the unchanged data contract**

Update `web/README.md` to state that the UI refresh does not change `work-shackle-web.json`, existing folders remain compatible, and task/settings navigation entries remain informational until separately implemented.

- [ ] **Step 4: Run every automated verification**

Run: `npm test && npm run check:isolation && GITHUB_ACTIONS=true npm run build`

Expected: all tests PASS, isolation PASS, TypeScript build PASS, and Vite emits assets with `/work-shackle-web/` base paths.

- [ ] **Step 5: Run browser visual checks**

Start the local Web preview, open `?preview=today`, and compare against the current App today preview at desktop width and a narrow desktop width. Check header, three tabs, countdown stage, local horse image, task cards, right column, drawer, modal, focus states, and absence of console errors.

- [ ] **Step 6: Verify source isolation and desktop cleanliness**

Run:

```bash
git diff --name-only 6759eea..HEAD
git diff --check
```

Expected: implementation changes are limited to `web/` plus this plan/README documentation; no file under desktop `src/` or `src-tauri/` is modified.

- [ ] **Step 7: Commit the integration**

```bash
git add web/src web/README.md
git commit -m "feat(web): complete app ui parity for today"
```

- [ ] **Step 8: Publish only the Web subtree**

Create a fresh subtree branch from `web/`, push it to `zaragui-hue/work-shackle-web` main using the existing repository-specific deploy key, wait for the GitHub Pages workflow, then verify `https://zaragui-hue.github.io/work-shackle-web/` loads the new design.

Expected: GitHub Pages reports success; the public site shows the new App-aligned Web UI and existing local folder data remains readable.
