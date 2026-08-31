# Countdown System Alert Headline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the cramped countdown headline with a full-width yellow system-alert strip that keeps long rotating copy readable and preserves the countdown hierarchy.

**Architecture:** Keep `WorkCountdownBanner` as the single presentation component and leave all countdown and progress data flow unchanged. Add one semantic alert-strip wrapper and one structural label in JSX, then express desktop and mobile behavior entirely in the colocated stylesheet.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Vite

---

### Task 1: Lock the alert-strip structure with a component test

**Files:**
- Modify: `src/features/today/WorkCountdownBanner.test.tsx`

- [x] **Step 1: Write the failing long-headline test**

Add a test that renders a real long rotating headline and checks that the structural system label and complete headline are both present:

```tsx
it("renders long countdown copy as a system notice", () => {
  const primaryText = "下班节点尚未渲染，先维持人类在线状态";

  render(
    <WorkCountdownBanner
      display={{
        phase: "working",
        primaryText,
        countdownText: "07:10:31",
      }}
    />,
  );

  expect(screen.getByText("SYSTEM NOTICE / SHIFT RELEASE")).toBeTruthy();
  expect(screen.getByRole("heading", { name: primaryText })).toBeTruthy();
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/features/today/WorkCountdownBanner.test.tsx`

Expected: FAIL because `SYSTEM NOTICE / SHIFT RELEASE` is not rendered yet.

### Task 2: Add the semantic alert-strip markup

**Files:**
- Modify: `src/features/today/WorkCountdownBanner.tsx:14-27`
- Test: `src/features/today/WorkCountdownBanner.test.tsx`

- [x] **Step 1: Separate the metadata row from the alert strip**

Replace the nested headline in the current heading row with a metadata row followed by the alert strip:

```tsx
<div className="work-countdown__heading">
  <div className="work-countdown__heading-row">
    <p className="work-countdown__kicker">
      <span className="work-countdown__live" aria-hidden="true" />
      LIVE / 距离释放
    </p>
    {progressState ? (
      <span className="work-countdown__percent">
        班味 {progressState.progress}%
      </span>
    ) : null}
  </div>
  <div className="work-countdown__alert-strip">
    <span className="work-countdown__alert-code">
      SYSTEM NOTICE / SHIFT RELEASE
    </span>
    <h2 className="work-countdown__headline">{display.primaryText}</h2>
  </div>
</div>
```

- [x] **Step 2: Run the focused component test**

Run: `npm test -- src/features/today/WorkCountdownBanner.test.tsx`

Expected: PASS for the original countdown-unit test and the new system-notice test.

### Task 3: Build the desktop and mobile alert-strip layout

**Files:**
- Modify: `src/features/today/WorkCountdownBanner.css:1-92`
- Modify: `src/features/today/WorkCountdownBanner.css:143-178`
- Modify: `src/styles/colorSystem.test.ts:100-114`

- [x] **Step 1: Replace the cramped title rules with the alert strip**

Introduce a heading wrapper, keep the metadata row compact, and let the title use the strip width:

```css
.work-countdown__heading {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.work-countdown__alert-strip {
  width: calc(100% + 8px);
  margin-left: -4px;
  padding: 10px 16px 12px;
  border-block: 3px solid var(--color-anchor);
  color: var(--color-anchor);
  background: var(--color-signal);
  transform: rotate(-0.6deg);
  transform-origin: left center;
}

.work-countdown__alert-code {
  display: block;
  margin-bottom: 5px;
  color: var(--color-danger);
  font-family: var(--font-data);
  font-size: 0.6rem;
  font-weight: 1000;
  letter-spacing: 0.14em;
}

.work-countdown__headline {
  margin: 0;
  color: var(--color-anchor);
  font-size: clamp(2rem, 3.6vw, 3.5rem);
  font-weight: 1000;
  line-height: 0.98;
  letter-spacing: -0.055em;
  text-wrap: balance;
  overflow-wrap: break-word;
}
```

Remove the previous `max-width: 8em`, white headline color, oversized desktop override, and `overflow-wrap: anywhere`.

- [x] **Step 2: Keep the metadata and alert strip clear on small screens**

Use the existing `520px` media query to remove the decorative tilt and reduce the alert-strip density:

```css
@media (max-width: 520px) {
  .work-countdown__heading { gap: 6px; }
  .work-countdown__alert-strip {
    width: 100%;
    margin-left: 0;
    padding: 9px 11px 10px;
    transform: none;
  }
  .work-countdown__headline {
    font-size: clamp(1.75rem, 8.6vw, 2.375rem);
    line-height: 1;
  }
}
```

- [x] **Step 3: Run focused layout and component tests**

Run: `npm test -- src/features/today/WorkCountdownBanner.test.tsx src/features/today/statusCockpitLayout.test.ts`

Expected: PASS with no changed countdown or cockpit behavior.

- [x] **Step 4: Update the visual-system contract**

Replace the retired hero-token assertion in `colorSystem.test.ts` with checks that the headline uses the signal-yellow strip and the new controlled `clamp(2rem, 3.6vw, 3.5rem)` size. Keep the poster-scale countdown and reaction-mark assertions unchanged.

### Task 4: Verify the completed UI

**Files:**
- Verify: `src/features/today/WorkCountdownBanner.tsx`
- Verify: `src/features/today/WorkCountdownBanner.css`
- Verify: `src/features/today/WorkCountdownBanner.test.tsx`

- [x] **Step 1: Run the full frontend test suite**

Run: `npm test`

Expected: all Vitest files pass.

- [x] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [x] **Step 3: Inspect the actual page at desktop and mobile widths**

Start the local preview, capture the Today page at the screenshot's desktop width and at a narrow mobile width, and confirm:

```text
- the longest rotating headline uses no more than three lines;
- no single-character forced wrapping or overlap appears;
- the yellow strip uses the formerly empty right-hand space;
- countdown digits remain visually dominant;
- the strip becomes level and stays within the panel on mobile.
```

- [x] **Step 4: Commit only the feature files**

```bash
git add \
  docs/superpowers/plans/2026-08-31-countdown-system-alert-headline.md \
  src/features/today/WorkCountdownBanner.tsx \
  src/features/today/WorkCountdownBanner.css \
  src/features/today/WorkCountdownBanner.test.tsx \
  src/styles/colorSystem.test.ts
git commit -m "feat: redesign countdown headline as alert strip"
```
