# Giant Badge Wild Typography Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved giant-badge typography hierarchy across Today, Tasks, Settings, and the application shell without changing behavior or causing responsive overflow.

**Architecture:** CSS custom properties own the display, countdown, title, task, and metadata scales. Component CSS consumes those roles with responsive `clamp()` values, short line heights, wrapping guards, and mobile overrides; the existing source-level style contract verifies the approved scale and reduced-motion behavior.

**Tech Stack:** React 19, TypeScript, CSS custom properties, Vitest, Testing Library, Vite

---

## File structure

- Modify `src/styles/tokens.css`: canonical typography roles and line-height variables.
- Modify `src/styles/colorSystem.test.ts`: typography source contract beside the existing color contract.
- Modify `src/shared/shell/AppShell.css`: larger brand, status, navigation, and header spacing.
- Modify `src/features/today/WorkCountdownBanner.css`: poster headline and giant time hierarchy.
- Modify `src/features/today/StatusCockpit.css`: giant meme mark and larger status speech.
- Modify `src/pages/TodayPage.css`: desktop cockpit height and mobile containment.
- Modify `src/features/today/WorkScheduleEditor.css`: scoreboard time and section headings.
- Modify `src/features/today/TodayTaskBoard.css` and `TodayTaskCard.css`: larger task hierarchy with compact metadata.
- Modify `src/pages/TasksPage.css`, `src/features/tasks/TaskList.css`, and `src/features/tasks/calendar/TaskCalendar.css`: carry the hierarchy into Tasks.
- Modify `src/pages/SettingsPage.css`, `src/features/settings/BusyRuleSection.css`, and `src/features/settings/StatusCopySection.css`: large page/section headings without enlarging form help.
- Modify `src/features/reminder/ReminderWindowView.css`: match reminder headline scale and long-copy wrapping.
- Do not change Tauri, IPC, task data, status automation, reminder logic, or navigation behavior.

### Task 1: Add the typography contract and scale tokens

**Files:**
- Modify: `src/styles/colorSystem.test.ts`
- Modify: `src/styles/tokens.css`

- [ ] **Step 1: Write the failing typography token test**

Add to `src/styles/colorSystem.test.ts`:

```ts
it("defines the giant badge typography roles", () => {
  const tokens = readSource("src/styles/tokens.css");

  expect(tokens).toContain("--font-size-hero: clamp(4rem, 6.9vw, 5.5rem)");
  expect(tokens).toContain("--font-size-countdown: clamp(8rem, 13.8vw, 11rem)");
  expect(tokens).toContain("--font-size-page-title: clamp(1.75rem, 3vw, 2.375rem)");
  expect(tokens).toContain("--font-size-task-title: clamp(1.125rem, 1.8vw, 1.375rem)");
  expect(tokens).toContain("--font-size-meta: clamp(0.8125rem, 1.15vw, 0.9375rem)");
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npm test -- --run src/styles/colorSystem.test.ts`

Expected: FAIL because the giant-badge type roles do not exist.

- [ ] **Step 3: Add the canonical typography roles**

Add to the type section in `src/styles/tokens.css`:

```css
--font-size-hero: clamp(4rem, 6.9vw, 5.5rem);
--font-size-countdown: clamp(8rem, 13.8vw, 11rem);
--font-size-countdown-secondary: clamp(3rem, 5.4vw, 4.25rem);
--font-size-brand: clamp(1.375rem, 2.2vw, 1.75rem);
--font-size-page-title: clamp(1.75rem, 3vw, 2.375rem);
--font-size-section-title: clamp(1.5rem, 2.4vw, 2rem);
--font-size-work-time: clamp(4rem, 6.4vw, 5rem);
--font-size-task-title: clamp(1.125rem, 1.8vw, 1.375rem);
--font-size-nav: clamp(0.9375rem, 1.35vw, 1.0625rem);
--font-size-meta: clamp(0.8125rem, 1.15vw, 0.9375rem);
--line-height-display: 0.88;
--letter-spacing-display: -0.075em;
```

- [ ] **Step 4: Run the token contract**

Run: `npm test -- --run src/styles/colorSystem.test.ts`

Expected: PASS.

### Task 2: Enlarge the shell and navigation

**Files:**
- Modify: `src/shared/shell/AppShell.css`
- Test: `src/shared/shell/AppNavigation.test.tsx`

- [ ] **Step 1: Add the shell type-role contract**

Add to `src/styles/colorSystem.test.ts`:

```ts
it("uses the brand and navigation type roles in the shell", () => {
  const shell = readSource("src/shared/shell/AppShell.css");
  expect(shell).toMatch(/\.ws-shell__heading[\s\S]*?font-size:\s*var\(--font-size-brand\)/);
  expect(shell).toMatch(/\.ws-shell__tab[\s\S]*?font-size:\s*var\(--font-size-nav\)/);
});
```

- [ ] **Step 2: Apply the larger shell scale**

Update existing selectors in `src/shared/shell/AppShell.css`:

```css
.ws-shell__brand {
  min-height: 78px;
  padding: 14px 16px 16px;
}

.ws-shell__logo {
  width: 46px;
  height: 46px;
  font-size: 0.78rem;
}

.ws-shell__heading {
  font-size: var(--font-size-brand);
  font-weight: 1000;
  line-height: 0.95;
  letter-spacing: -0.065em;
}

.ws-shell__live {
  min-height: 46px;
  padding: 9px 14px;
  font-size: var(--font-size-nav);
}

.ws-shell__tab {
  min-height: 50px;
  padding: 10px 16px;
  font-size: var(--font-size-nav);
}
```

At `max-width: 900px`, preserve the existing icon-only live status and use `min-height: 46px` for tabs. At `max-width: 520px`, set the brand heading to `1.25rem`, the logo to `40px`, and tab labels to `0.9rem`.

- [ ] **Step 3: Run shell tests**

Run: `npm test -- --run src/styles/colorSystem.test.ts src/shared/shell/AppNavigation.test.tsx`

Expected: all tests PASS.

### Task 3: Build the poster-scale Today cockpit

**Files:**
- Modify: `src/pages/TodayPage.css`
- Modify: `src/features/today/WorkCountdownBanner.css`
- Modify: `src/features/today/StatusCockpit.css`
- Test: `src/features/today/WorkCountdownBanner.test.tsx`
- Test: `src/features/today/todayMascotPlaceholders.test.tsx`

- [ ] **Step 1: Add the cockpit typography contract**

Add to `src/styles/colorSystem.test.ts`:

```ts
it("uses poster-scale headline, countdown, and reaction type", () => {
  const countdown = readSource("src/features/today/WorkCountdownBanner.css");
  const cockpit = readSource("src/features/today/StatusCockpit.css");
  expect(countdown).toMatch(/\.work-countdown__headline[\s\S]*?font-size:\s*var\(--font-size-hero\)/);
  expect(countdown).toMatch(/\.work-countdown__digit--hours[\s\S]*?font-size:\s*var\(--font-size-countdown\)/);
  expect(cockpit).toMatch(/\.status-cockpit__meme-mark[\s\S]*?font-size:\s*clamp\(10rem,\s*17vw,\s*13\.75rem\)/);
});
```

- [ ] **Step 2: Enlarge and contain the countdown**

Update existing selectors in `src/features/today/WorkCountdownBanner.css`:

```css
.work-countdown { min-height: 360px; grid-template-rows: auto 1fr auto; }
.work-countdown__headline {
  max-width: 8em;
  font-size: var(--font-size-hero);
  font-weight: 1000;
  line-height: var(--line-height-display);
  letter-spacing: var(--letter-spacing-display);
  text-wrap: balance;
}
.work-countdown__clock { align-self: end; gap: 18px; }
.work-countdown__digit--hours { font-size: var(--font-size-countdown); line-height: 0.72; }
.work-countdown__digit:not(.work-countdown__digit--hours) { font-size: var(--font-size-countdown-secondary); }
.work-countdown__unit-label { font-size: var(--font-size-meta); }
.work-countdown__track { height: 62px; }
```

At `max-width: 760px`, set the headline to `clamp(2.375rem, 11vw, 3rem)`, hour to `clamp(4.5rem, 23vw, 5.75rem)`, and secondary digits to `clamp(1.875rem, 9vw, 2.625rem)`.

- [ ] **Step 3: Enlarge the reaction field**

Update `src/features/today/StatusCockpit.css`:

```css
.status-cockpit__reaction { min-height: 360px; }
.status-cockpit__meme { min-height: 280px; grid-template-columns: 128px minmax(0, 1fr); }
.status-cockpit__mascot { width: 146px; height: 184px; }
.status-cockpit__meme-mark { right: -24px; top: -70px; font-size: clamp(10rem, 17vw, 13.75rem); }
.status-cockpit__speech { padding: 16px; }
.status-cockpit__speech strong { font-size: clamp(0.9375rem, 1.5vw, 1.125rem); }
.status-cockpit__speech p {
  margin-top: 8px;
  font-size: clamp(1.125rem, 1.9vw, 1.375rem);
  line-height: 1.25;
  overflow-wrap: anywhere;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
```

At `max-width: 860px`, set the reaction minimum height to `270px`, meme mark to `clamp(7.5rem, 38vw, 10rem)`, and speech copy to `clamp(1.0625rem, 4.8vw, 1.1875rem)`.

- [ ] **Step 4: Match the stage height and skeletons**

In `src/pages/TodayPage.css`, set the stage minimum height to `410px`, the countdown skeleton minimum height to `360px`, and keep `min-height: 0` below 760 px so the stacked layout grows naturally.

- [ ] **Step 5: Run Today tests**

Run: `npm test -- --run src/styles/colorSystem.test.ts src/features/today/WorkCountdownBanner.test.tsx src/features/today/todayMascotPlaceholders.test.tsx`

Expected: all tests PASS.

### Task 4: Enlarge workday, task, and settings hierarchy

**Files:**
- Modify: `src/features/today/WorkScheduleEditor.css`
- Modify: `src/features/today/TodayTaskBoard.css`
- Modify: `src/features/today/TodayTaskCard.css`
- Modify: `src/pages/TasksPage.css`
- Modify: `src/features/tasks/TaskList.css`
- Modify: `src/features/tasks/calendar/TaskCalendar.css`
- Modify: `src/pages/SettingsPage.css`
- Modify: `src/features/settings/BusyRuleSection.css`
- Modify: `src/features/settings/StatusCopySection.css`
- Modify: `src/features/reminder/ReminderWindowView.css`

- [ ] **Step 1: Apply key time and section title roles**

```css
.work-schedule-editor__title { font-size: var(--font-size-section-title); line-height: .95; }
.work-schedule-editor__time { font-size: var(--font-size-work-time); }
.today-board__section-title { font-size: var(--font-size-section-title); }
.tasks-page__masthead h2,
.settings-page__intro h2 { font-size: var(--font-size-page-title); line-height: .95; }
```

- [ ] **Step 2: Apply task title and metadata roles**

```css
.today-task-card { min-height: 82px; }
.today-task-card__title,
.task-list__title { font-size: var(--font-size-task-title); line-height: 1.1; overflow-wrap: anywhere; }
.today-task-card__deadline,
.today-task-card__foot,
.task-list__ddl,
.task-list__foot { font-size: var(--font-size-meta); }
```

Keep task titles to two lines with `display: -webkit-box`, `-webkit-line-clamp: 2`, `-webkit-box-orient: vertical`, and `overflow: hidden`.

- [ ] **Step 3: Enlarge settings boundaries, not form help**

```css
.settings-section__title { font-size: var(--font-size-section-title); line-height: 1; }
.settings-busy-rules__card-title,
.settings-status-copies__header { font-size: var(--font-size-task-title); }
.settings-section__hint,
.settings-busy-rules__range-preview { font-size: var(--font-size-meta); }
```

- [ ] **Step 4: Match reminder headline scale**

```css
.reminder-window__headline { font-size: var(--font-size-page-title); line-height: .95; overflow-wrap: anywhere; }
.reminder-window__task { font-size: var(--font-size-task-title); line-height: 1.1; }
.reminder-window__remaining,
.reminder-window__emotion { font-size: var(--font-size-meta); }
```

- [ ] **Step 5: Run related regression tests**

Run: `npm test -- --run src/features/today/WorkScheduleEditor.test.tsx src/features/tasks/calendar/TaskCalendar.test.tsx src/features/settings/BusyRuleSection.test.tsx src/features/reminder/ReminderWindowView.test.tsx`

Expected: all tests PASS.

### Task 5: Full verification

**Files:**
- Modify only files that fail the checks below.

- [ ] **Step 1: Run formatting and source checks**

Run: `git diff --check`

Expected: no output and exit code 0.

- [ ] **Step 2: Run the complete test suite**

Run: `npm test -- --run`

Expected: every test passes.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [ ] **Step 4: Inspect desktop rendering**

At approximately 1280×840 verify the headline is 64–88 px, countdown hour is 128–176 px, task titles are 18–22 px, and the cockpit remains readable without clipped actions.

- [ ] **Step 5: Inspect 390 px rendering**

Verify no horizontal overflow; the headline is 38–48 px, hour is 72–92 px, navigation remains usable, long task/status text wraps, and offset shadows do not expand the page width.

- [ ] **Step 6: Verify reduced motion**

Enable reduced motion and confirm the status poster-slam animation is disabled while final text remains visible.
