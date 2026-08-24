# Dopamine Brutalist Color Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current cream/cobalt/lime styling with the approved high-contrast dopamine-brutalist system while preserving behavior and long-form readability.

**Architecture:** Central CSS custom properties define the seven approved color roles and compatibility aliases. Shared shell and UI primitives consume those roles first, then Today, Tasks, Settings, and reminder surfaces receive deliberate component-level mappings; one file-based Vitest contract prevents the palette from drifting back to retired colors.

**Tech Stack:** React 19, TypeScript, CSS custom properties, Tauri, Vitest, Testing Library

---

## File structure

- Create `src/styles/colorSystem.test.ts`: source-level contract for approved tokens and retired-color removal.
- Modify `src/styles/tokens.css`: canonical color roles, aliases, borders, radii, and offset shadows.
- Modify `src/styles/base.css`: outer canvas, selection, focus, and reduced-motion foundations.
- Modify `src/shared/shell/AppShell.css`: yellow header band, hard-edged navigation, status treatment.
- Modify shared primitives under `src/shared/ui/`: consistent borders, shadows, inputs, overlays, and focus states.
- Modify Today CSS under `src/features/today/` and `src/pages/TodayPage.css`: cobalt countdown, coral reaction, yellow sticker, black tool panel.
- Modify Tasks CSS under `src/features/tasks/` and `src/pages/TasksPage.css`: cream reading surfaces with blue/red rails and compact yellow tags.
- Modify Settings and reminder CSS: quiet cream forms, controlled accents, semantic errors.
- Do not modify TypeScript behavior, Rust, SQLite, IPC commands, task data flow, or reminder/status automation.

### Task 1: Lock the palette contract

**Files:**
- Create: `src/styles/colorSystem.test.ts`
- Modify: `src/styles/tokens.css`
- Modify: `src/styles/base.css`

- [ ] **Step 1: Write the failing token contract**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8").toLowerCase();

describe("dopamine brutalist color system", () => {
  it("defines the approved semantic palette", () => {
    const tokens = readSource("src/styles/tokens.css");

    expect(tokens).toContain("--color-canvas: #fff7df");
    expect(tokens).toContain("--color-stage: #2448ff");
    expect(tokens).toContain("--color-signal: #ffd45e");
    expect(tokens).toContain("--color-reaction: #ff7a52");
    expect(tokens).toContain("--color-danger: #ff3d57");
    expect(tokens).toContain("--color-anchor: #241c16");
    expect(tokens).toContain("--color-ink-muted: #6e5548");
  });

  it("removes the retired core palette", () => {
    const source = [
      "src/styles/tokens.css",
      "src/styles/base.css",
      "src/shared/shell/AppShell.css",
      "src/pages/TodayPage.css",
      "src/features/today/StatusCockpit.css",
    ].map(readSource).join("\n");

    for (const retired of ["#efede5", "#345cff", "#cfff24", "#ff4b2e", "#d93822"]) {
      expect(source).not.toContain(retired);
    }
  });
});
```

- [ ] **Step 2: Run the contract and confirm it fails**

Run: `npm test -- --run src/styles/colorSystem.test.ts`

Expected: FAIL because the approved semantic tokens do not exist and retired values are still present.

- [ ] **Step 3: Replace the core color, shape, and shadow tokens**

In `src/styles/tokens.css`, replace the existing color block and visual aliases with:

```css
:root {
  --color-canvas: #fff7df;
  --color-stage: #2448ff;
  --color-signal: #ffd45e;
  --color-reaction: #ff7a52;
  --color-danger: #ff3d57;
  --color-anchor: #241c16;
  --color-ink-muted: #6e5548;

  --color-paper: var(--color-canvas);
  --color-paper-raised: color-mix(in srgb, var(--color-canvas) 82%, white);
  --color-paper-deep: color-mix(in srgb, var(--color-canvas) 78%, var(--color-signal));
  --color-ink: var(--color-anchor);
  --color-ink-soft: color-mix(in srgb, var(--color-anchor) 82%, white);
  --color-blue: var(--color-stage);
  --color-lime: var(--color-signal);
  --color-orange: var(--color-reaction);
  --color-overlay: color-mix(in srgb, var(--color-anchor) 72%, transparent);
  --color-green: var(--color-stage);
  --color-wheat: var(--color-signal);

  --radius-card: 8px;
  --radius-button: 4px;
  --radius-panel: 12px;
  --radius-ticket: 3px;
  --radius-stamp: 999px;

  --shadow-soft: 8px 8px 0 var(--color-anchor);
  --shadow-sticker: 4px 4px 0 var(--color-anchor);
  --shadow-ticket: 3px 3px 0 var(--color-anchor);
  --shadow-stage: 7px 7px 0 var(--color-danger);
  --border-ink: 2px solid var(--color-anchor);
  --border-ink-strong: 3px solid var(--color-anchor);
  --border-ink-soft: 1px solid color-mix(in srgb, var(--color-anchor) 42%, transparent);
  --border-green: 2px solid var(--color-stage);
}
```

Keep the existing font, spacing, and type-scale declarations between these blocks unchanged.

- [ ] **Step 4: Replace the ambient background and global focus treatment**

In `src/styles/base.css`, use flat fields instead of the retired blue/lime glow:

```css
body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  color: var(--color-ink);
  background-color: var(--color-anchor);
  background-image: radial-gradient(
    circle,
    color-mix(in srgb, var(--color-canvas) 18%, transparent) 0 1px,
    transparent 1.2px
  );
  background-size: 16px 16px;
}

::selection {
  color: var(--color-anchor);
  background: var(--color-signal);
}

:focus-visible {
  outline: 3px solid var(--color-danger);
  outline-offset: 3px;
}
```

- [ ] **Step 5: Run the contract and full foundational tests**

Run: `npm test -- --run src/styles/colorSystem.test.ts src/shared/ui/Mascot.test.tsx src/shared/shell/AppNavigation.test.tsx`

Expected: all tests PASS.

- [ ] **Step 6: Commit the token foundation**

```bash
git add src/styles/colorSystem.test.ts src/styles/tokens.css src/styles/base.css
git commit -m "style: establish dopamine brutalist color tokens"
```

### Task 2: Restyle the shell and shared controls

**Files:**
- Modify: `src/shared/shell/AppShell.css`
- Modify: `src/shared/ui/Button.css`
- Modify: `src/shared/ui/Card.css`
- Modify: `src/shared/ui/Input.css`
- Modify: `src/shared/ui/Modal.css`
- Modify: `src/shared/ui/Drawer.css`
- Modify: `src/shared/ui/EmptyState.css`
- Test: `src/shared/shell/AppNavigation.test.tsx`

- [ ] **Step 1: Extend the contract for shell color responsibilities**

Add this test to `src/styles/colorSystem.test.ts`:

```ts
it("assigns signal yellow to the shell and stage blue to active navigation", () => {
  const shell = readSource("src/shared/shell/AppShell.css");

  expect(shell).toMatch(/\.ws-shell__brand[\s\S]*background:\s*var\(--color-signal\)/);
  expect(shell).toMatch(/\.ws-shell__tab--active[\s\S]*background:\s*var\(--color-stage\)/);
});
```

- [ ] **Step 2: Run the shell contract and confirm it fails**

Run: `npm test -- --run src/styles/colorSystem.test.ts`

Expected: FAIL because the shell does not yet assign the approved roles.

- [ ] **Step 3: Apply the hard-edged shell treatment**

In `src/shared/shell/AppShell.css`, preserve layout and breakpoints while applying these declarations to the existing selectors:

```css
.ws-shell {
  border: var(--border-ink-strong);
  border-radius: 12px;
  color: var(--color-ink);
  background: var(--color-paper);
  box-shadow: var(--shadow-soft);
}

.ws-shell__brand {
  border-bottom: var(--border-ink-strong);
  background: var(--color-signal);
}

.ws-shell__live {
  border: 2px solid var(--color-anchor);
  border-radius: 3px;
  background: var(--color-paper-raised);
  box-shadow: 3px 3px 0 var(--color-anchor);
}

.ws-shell__nav {
  border: 2px solid var(--color-anchor);
  border-radius: 4px;
  background: var(--color-paper-raised);
}

.ws-shell__tab {
  border-radius: 0;
  color: var(--color-anchor);
  background: transparent;
}

.ws-shell__tab--active {
  color: white;
  background: var(--color-stage);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, white 20%, transparent);
}

.ws-shell__tab--active .ws-shell__tab-icon {
  color: var(--color-signal);
}
```

- [ ] **Step 4: Align shared primitives with the same interaction language**

Apply these exact role mappings while keeping component sizing and disabled logic intact:

```css
/* Button.css */
.ws-button--primary { color: white; background: var(--color-anchor); box-shadow: 4px 4px 0 var(--color-danger); }
.ws-button--secondary { color: var(--color-anchor); background: var(--color-paper-raised); box-shadow: 3px 3px 0 var(--color-stage); }
.ws-button--wheat { color: var(--color-anchor); background: var(--color-signal); box-shadow: 3px 3px 0 var(--color-anchor); }
.ws-button:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: 1px 1px 0 var(--color-anchor); }

/* Card.css */
.ws-card { border: 2px solid var(--color-anchor); border-radius: var(--radius-card); background: var(--color-paper-raised); }

/* Input.css */
.ws-input { border: 2px solid var(--color-anchor); border-radius: var(--radius-button); background: var(--color-paper-raised); }
.ws-input:focus-visible { border-color: var(--color-stage); outline: 3px solid color-mix(in srgb, var(--color-signal) 65%, transparent); }

/* Modal.css and Drawer.css */
.ws-modal__panel { background: var(--color-paper-raised); box-shadow: 7px 7px 0 var(--color-anchor); }
.ws-drawer__panel { background: var(--color-paper-raised); box-shadow: -7px 0 0 var(--color-anchor); }

/* EmptyState.css */
.ws-empty-state { border: 2px dashed var(--color-anchor); background: color-mix(in srgb, var(--color-signal) 12%, var(--color-paper-raised)); }
```

- [ ] **Step 5: Verify shell behavior and the palette contract**

Run: `npm test -- --run src/styles/colorSystem.test.ts src/shared/shell/AppNavigation.test.tsx`

Expected: all tests PASS; navigation semantics and accessible names remain unchanged.

- [ ] **Step 6: Commit shared presentation**

```bash
git add src/styles/colorSystem.test.ts src/shared/shell/AppShell.css src/shared/ui
git commit -m "style: sharpen shell and shared controls"
```

### Task 3: Recolor the Today cockpit and workday tools

**Files:**
- Modify: `src/pages/TodayPage.css`
- Modify: `src/features/today/StatusCockpit.css`
- Modify: `src/features/today/WorkCountdownBanner.css`
- Modify: `src/features/today/WorkScheduleEditor.css`
- Modify: `src/features/today/WorkStatusPanel.css`
- Modify: `src/features/today/WorkdayStatusNotice.css`
- Modify: `src/features/today/OvertimeBanner.css`
- Modify: `src/features/today/WorkEndDecisionBanner.css`
- Test: `src/styles/colorSystem.test.ts`
- Test: `src/features/today/todayMascotPlaceholders.test.tsx`

- [ ] **Step 1: Add a Today color-role contract**

Add this test to `src/styles/colorSystem.test.ts`:

```ts
it("keeps the cockpit blue, reaction coral, and meme sticker yellow", () => {
  const page = readSource("src/pages/TodayPage.css");
  const cockpit = readSource("src/features/today/StatusCockpit.css");
  const tools = readSource("src/features/today/WorkScheduleEditor.css");

  expect(page).toMatch(/\.today-page__stage[\s\S]*background:\s*var\(--color-stage\)/);
  expect(cockpit).toMatch(/\.status-cockpit__reaction[\s\S]*background:\s*var\(--color-reaction\)/);
  expect(cockpit).toMatch(/\.status-cockpit__speech[\s\S]*background:\s*var\(--color-signal\)/);
  expect(tools).toMatch(/\.work-schedule-editor[\s\S]*background:\s*var\(--color-anchor\)/);
});
```

- [ ] **Step 2: Run the Today contract and confirm it fails**

Run: `npm test -- --run src/styles/colorSystem.test.ts`

Expected: FAIL on the Today stage, reaction, or tool role assignments.

- [ ] **Step 3: Apply the approved cockpit color blocks**

Use these declarations while preserving the current cockpit grid and responsive order:

```css
/* TodayPage.css */
.today-page__stage {
  border: var(--border-ink-strong);
  border-radius: 8px;
  color: white;
  background: var(--color-stage);
  box-shadow: var(--shadow-stage);
}

/* StatusCockpit.css */
.status-cockpit__reaction {
  border: 3px solid var(--color-anchor);
  border-radius: 4px;
  color: var(--color-anchor);
  background: var(--color-reaction);
}
.status-cockpit__status-row > span { color: var(--color-anchor); }
.status-cockpit__meme-mark { color: var(--color-danger); opacity: .5; -webkit-text-stroke: 2px var(--color-anchor); }
.status-cockpit__speech {
  border: 3px solid var(--color-anchor);
  border-radius: 6px 6px 6px 1px;
  color: var(--color-anchor);
  background: var(--color-signal);
  box-shadow: 5px 5px 0 var(--color-anchor);
}
```

- [ ] **Step 4: Reassign countdown, status, and schedule accents**

```css
/* WorkCountdownBanner.css */
.work-countdown__kicker { color: var(--color-signal); }
.work-countdown__fill { background: var(--color-signal); }
.work-countdown__percent { color: var(--color-anchor); background: var(--color-signal); box-shadow: 3px 3px 0 var(--color-anchor); }

/* WorkScheduleEditor.css */
.work-schedule-editor { color: white; background: var(--color-anchor); border: var(--border-ink-strong); }
.work-schedule-editor__kicker { color: var(--color-reaction); }
.work-schedule-editor__time { color: var(--color-anchor); background: var(--color-signal); box-shadow: 5px 5px 0 var(--color-danger); }
.work-schedule-editor .ws-input { color: var(--color-anchor); background-color: var(--color-paper-raised); }
.work-reminder-row { color: var(--color-anchor); background: var(--color-paper-raised); }

/* WorkStatusPanel.css */
.work-status-panel--stage .ws-input { color: var(--color-anchor); background: var(--color-signal); }

/* WorkdayStatusNotice.css */
.workday-status-notice { background: var(--color-signal); }
.workday-status-notice--error { background: var(--color-danger); }
```

Use `var(--color-danger)` for overtime, chased, and due states; do not use red for neutral loading or empty states.

- [ ] **Step 5: Run Today and contract tests**

Run: `npm test -- --run src/styles/colorSystem.test.ts src/features/today/todayMascotPlaceholders.test.tsx src/features/today/WorkScheduleEditor.test.tsx src/features/today/WorkCountdownBanner.test.tsx`

Expected: all tests PASS; workhorse assets and accessible labels remain present.

- [ ] **Step 6: Commit the Today redesign**

```bash
git add src/styles/colorSystem.test.ts src/pages/TodayPage.css src/features/today
git commit -m "style: apply dopamine cockpit color blocks"
```

### Task 4: Recolor task lists, calendar, drawers, and priority states

**Files:**
- Modify: `src/pages/TasksPage.css`
- Modify: `src/features/tasks/TaskList.css`
- Modify: `src/features/today/TodayTaskCard.css`
- Modify: `src/features/tasks/priorityTone.css`
- Modify: `src/features/tasks/calendar/TaskCalendar.css`
- Modify: `src/features/tasks/calendar/CalendarDayDrawer.css`
- Modify: `src/features/tasks/TaskDrawer.css`
- Modify: `src/features/tasks/CreateTaskModal.css`
- Modify: `src/features/tasks/ContactPicker.css`
- Test: `src/features/tasks/calendar/TaskCalendar.test.tsx`

- [ ] **Step 1: Preserve priority semantics with approved colors**

Replace `src/features/tasks/priorityTone.css` with:

```css
.priority-tone--low { background: color-mix(in srgb, var(--color-stage) 14%, var(--color-paper-raised)); }
.priority-tone--normal { background: color-mix(in srgb, var(--color-signal) 34%, var(--color-paper-raised)); }
.priority-tone--notice { background: var(--color-signal); }
.priority-tone--anxious { background: var(--color-reaction); }
.priority-tone--urgent { background: var(--color-danger); }
```

All labels keep dark text and a border or written label; color remains supplemental.

- [ ] **Step 2: Apply editorial rails and compact tags**

Use these patterns in `TaskList.css`, `TodayTaskCard.css`, and `TaskCalendar.css` without changing component markup:

```css
.task-list__item,
.today-task-card {
  border-color: var(--color-anchor);
  background: var(--color-paper-raised);
}

.task-list__priority,
.today-task-card__priority {
  background: var(--color-stage);
}

.task-list__item--terminal .task-list__priority,
.today-task-card--overdue .today-task-card__priority {
  background: var(--color-danger);
}

.task-list__chip,
.today-task-card__meta-chip,
.task-calendar__task-count {
  border: 2px solid var(--color-anchor);
  border-radius: 2px;
  color: var(--color-anchor);
  background: var(--color-signal);
}
```

Do not add TypeScript classes solely for visual styling.

- [ ] **Step 3: Quiet drawers, modal forms, and contact selection**

```css
.task-drawer__section,
.create-task-form__reminders,
.contact-picker {
  color: var(--color-anchor);
  background: var(--color-paper-raised);
}

.contact-picker__chip--selected {
  border-color: var(--color-stage);
  background: color-mix(in srgb, var(--color-stage) 10%, var(--color-paper-raised));
}

.task-calendar__day--selected {
  border-color: var(--color-anchor);
  background: var(--color-signal);
  box-shadow: 3px 3px 0 var(--color-stage);
}
```

- [ ] **Step 4: Run task and calendar regressions**

Run: `npm test -- --run src/features/tasks/calendar/TaskCalendar.test.tsx src/features/tasks/calendar/CalendarDayDrawer.test.tsx src/features/tasks/calendar/busyLevel.test.ts`

Expected: all tests PASS; selected, overdue, busy, and empty states keep their semantics.

- [ ] **Step 5: Commit task surfaces**

```bash
git add src/pages/TasksPage.css src/features/tasks src/features/today/TodayTaskCard.css
git commit -m "style: sharpen task and calendar surfaces"
```

### Task 5: Recolor Settings and reminder windows

**Files:**
- Modify: `src/pages/SettingsPage.css`
- Modify: `src/features/settings/BusyRuleSection.css`
- Modify: `src/features/settings/StatusCopySection.css`
- Modify: `src/features/reminder/ReminderWindowView.css`
- Modify: `src/pages/StartupPanel.css`
- Test: `src/features/settings/BusyRuleSection.test.tsx`
- Test: `src/features/reminder/ReminderWindowView.test.tsx`

- [ ] **Step 1: Apply restrained settings roles**

```css
.settings-page__intro {
  border: var(--border-ink-strong);
  border-radius: 6px;
  color: white;
  background: var(--color-stage);
  box-shadow: 7px 7px 0 var(--color-signal);
}

.settings-section,
.settings-busy-rules__card,
.settings-status-copies__item {
  border: 2px solid var(--color-anchor);
  border-radius: 6px;
  color: var(--color-anchor);
  background: var(--color-paper-raised);
}

.settings-page__error,
.settings-section__error {
  color: var(--color-danger);
}
```

Do not place coral, yellow, and red together inside ordinary settings cards; blue is the only non-semantic accent on this page.

- [ ] **Step 2: Make reminder windows feel urgent without confusing severity**

```css
.reminder-window {
  background: var(--color-anchor);
}

.reminder-window__card {
  border: var(--border-ink-strong);
  border-radius: 8px;
  background: var(--color-paper-raised);
  box-shadow: 7px 7px 0 var(--color-reaction);
}

.reminder-window__card[data-reminder-kind="ddl_10"],
.reminder-window__card[data-reminder-kind="ddl_due"] {
  box-shadow: 7px 7px 0 var(--color-danger);
}

.reminder-window__hero {
  color: var(--color-anchor);
  background: var(--color-signal);
}
```

- [ ] **Step 3: Run settings and reminder tests**

Run: `npm test -- --run src/features/settings/BusyRuleSection.test.tsx src/features/reminder/ReminderWindowView.test.tsx`

Expected: all tests PASS; save, error, dismiss, and reminder actions retain their accessible names.

- [ ] **Step 4: Commit secondary surfaces**

```bash
git add src/pages/SettingsPage.css src/pages/StartupPanel.css src/features/settings src/features/reminder/ReminderWindowView.css
git commit -m "style: align settings and reminders with dopamine palette"
```

### Task 6: Full verification and visual QA

**Files:**
- Modify only files that fail the checks above.
- Test: all `src/**/*.test.ts` and `src/**/*.test.tsx`

- [ ] **Step 1: Scan for retired core colors**

Run:

```bash
rg -n "#efede5|#345cff|#cfff24|#ff4b2e|#d93822" src --glob "*.css"
```

Expected: no matches. If a match is an intentional third-party asset color, document it in `colorSystem.test.ts`; do not silently weaken the scan.

- [ ] **Step 2: Run the complete automated suite**

Run: `npm test -- --run`

Expected: every test file passes.

- [ ] **Step 3: Build the production bundle**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully and emit `dist/`.

- [ ] **Step 4: Inspect the three primary pages at desktop width**

With the existing dev app running, inspect Today, Tasks, and Settings around 1280×840. Verify:

- the shell header is yellow and active navigation is blue;
- Today uses a blue countdown, coral reaction, yellow sticker, and black tool panel;
- task content remains cream and readable;
- Settings does not use all accent colors in the same card;
- focus outlines remain visible;
- the console contains no errors or warnings introduced by the redesign.

- [ ] **Step 5: Inspect responsive and reduced-motion states**

At 390×900, verify no horizontal overflow, clipped status copy, hidden buttons, or overlapping offset shadows. Enable reduced motion and verify sticker rotation and translation are removed while state changes remain understandable.

- [ ] **Step 6: Check semantic states**

Exercise normal, chased, urgent, overdue, success, error, loading, disabled, selected, and keyboard-focus states. Confirm red is never the only carrier of meaning and body copy always uses dark text on cream/yellow/coral surfaces.

- [ ] **Step 7: Commit verification fixes**

```bash
git add src
git commit -m "test: verify dopamine color redesign"
```
