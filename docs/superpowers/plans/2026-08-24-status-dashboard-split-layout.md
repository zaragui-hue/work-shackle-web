# Status Dashboard Split Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the blue countdown and orange work-status areas into sibling, equal-height Dashboard panels with a desktop 68/32 split and a non-overlapping mobile stack.

**Architecture:** Keep the existing React data flow and component ownership. Add semantic panel boundaries in `StatusCockpit`, move the blue stage surface from `TodayPage` into the countdown panel, and enforce the approved desktop/mobile layout through focused component and CSS-contract tests.

**Tech Stack:** React 19, TypeScript, CSS Grid, Vitest, Testing Library, Tauri 2

---

## File Structure

- Create `src/features/today/StatusCockpit.test.tsx`: verify the countdown and status areas are sibling panels and status content remains inside the orange panel.
- Modify `src/features/today/StatusCockpit.tsx`: expose semantic panel boundaries without changing data flow.
- Create `src/features/today/statusCockpitLayout.test.ts`: verify the approved 68/32 desktop split, panel surfaces, clipping, and mobile stack.
- Modify `src/features/today/StatusCockpit.css`: own the shared frame, blue work panel, orange status panel, equal-height grid, and responsive behavior.
- Modify `src/pages/TodayPage.css`: make the outer stage wrapper layout-only so it no longer paints one blue surface behind both panels.

### Task 1: Establish Two Semantic Sibling Panels

**Files:**
- Create: `src/features/today/StatusCockpit.test.tsx`
- Modify: `src/features/today/StatusCockpit.tsx:24-55`

- [ ] **Step 1: Write the failing component tests**

Create `src/features/today/StatusCockpit.test.tsx`:

```tsx
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StatusCockpit } from "./StatusCockpit";

vi.mock("./WorkStatusContext", () => ({
  useWorkStatus: () => ({
    current: {
      recordId: "status-1",
      statusType: "chased_by_requirements",
      emoji: "🏃",
      name: "被需求追杀",
      displayCopy: "需求说不急，只是希望你十分钟前交。",
      workDate: "2026-08-24",
      startAtMs: 1,
    },
    loading: false,
  }),
}));

vi.mock("./WorkStatusPanel", () => ({
  WorkStatusPanel: () => <div>精神状态选择</div>,
}));

vi.mock("../../shared/ui", () => ({
  Mascot: () => <div>精神状态吉祥物</div>,
}));

afterEach(cleanup);

describe("StatusCockpit", () => {
  it("renders countdown and status as sibling panels", () => {
    render(
      <StatusCockpit>
        <div>倒计时主视觉</div>
      </StatusCockpit>,
    );

    const countdown = screen.getByLabelText("下班倒计时");
    const status = screen.getByLabelText("当前工作状态");

    expect(countdown.parentElement).toBe(status.parentElement);
    expect(countdown.nextElementSibling).toBe(status);
    expect(within(countdown).getByText("倒计时主视觉")).toBeTruthy();
  });

  it("keeps status controls, mascot, and copy inside the status panel", () => {
    render(
      <StatusCockpit>
        <div>倒计时主视觉</div>
      </StatusCockpit>,
    );

    const countdown = screen.getByLabelText("下班倒计时");
    const status = screen.getByLabelText("当前工作状态");

    expect(within(status).getByText("精神状态选择")).toBeTruthy();
    expect(within(status).getByText("精神状态吉祥物")).toBeTruthy();
    expect(within(status).getByText("被需求追杀")).toBeTruthy();
    expect(within(countdown).queryByText("被需求追杀")).toBeNull();
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```bash
npm test -- src/features/today/StatusCockpit.test.tsx
```

Expected: FAIL because the countdown wrapper has no accessible panel label.

- [ ] **Step 3: Add semantic panel elements**

Replace the `StatusCockpit` return body with:

```tsx
return (
  <div className="status-cockpit">
    <section className="status-cockpit__work" aria-label="下班倒计时">
      {children}
    </section>
    <aside className="status-cockpit__reaction" aria-label="当前工作状态">
      <div className="status-cockpit__status-row">
        <span>当前精神档位</span>
        <WorkStatusPanel variant="stage" />
      </div>
      {loading || !current || !reaction ? (
        <div className="status-cockpit__reaction-skeleton" aria-label="读取当前状态" />
      ) : (
        <div className="status-cockpit__meme">
          <span className="status-cockpit__meme-mark" aria-hidden="true">
            {reaction.memeMark}
          </span>
          <Mascot
            state={reaction.mascot}
            animation={reaction.animation}
            size="lg"
            className="status-cockpit__mascot"
          />
          <div
            key={`${current.statusType}-${current.startAtMs}`}
            className="status-cockpit__speech"
          >
            <strong>{current.emoji} {current.name}</strong>
            <p>{reaction.copy}</p>
          </div>
        </div>
      )}
    </aside>
  </div>
);
```

- [ ] **Step 4: Run the component tests**

Run:

```bash
npm test -- src/features/today/StatusCockpit.test.tsx
```

Expected: both tests PASS.

- [ ] **Step 5: Commit the semantic structure change**

```bash
git add src/features/today/StatusCockpit.tsx src/features/today/StatusCockpit.test.tsx
git commit -m "test: define status cockpit panel boundaries"
```

### Task 2: Lock the Approved Split Layout in a CSS Contract

**Files:**
- Create: `src/features/today/statusCockpitLayout.test.ts`
- Modify: `src/features/today/StatusCockpit.css`
- Modify: `src/pages/TodayPage.css`

- [ ] **Step 1: Write the failing CSS-contract tests**

Create `src/features/today/statusCockpitLayout.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readCss = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8").toLowerCase();

describe("status cockpit split layout", () => {
  const cockpit = readCss("src/features/today/StatusCockpit.css");
  const page = readCss("src/pages/TodayPage.css");

  it("uses the approved desktop ratio with equal-height sibling panels", () => {
    expect(cockpit).toMatch(
      /\.status-cockpit\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0,\s*2\.15fr\)\s+minmax\(285px,\s*1fr\)/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit\s*\{[\s\S]*?align-items:\s*stretch/,
    );
  });

  it("gives each panel its own surface and clipping boundary", () => {
    expect(cockpit).toMatch(
      /\.status-cockpit__work\s*\{[\s\S]*?background:\s*var\(--color-stage\)/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit__work\s*\{[\s\S]*?overflow:\s*hidden/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit__reaction\s*\{[\s\S]*?background:\s*var\(--color-reaction\)/,
    );
    expect(cockpit).toMatch(
      /\.status-cockpit__reaction\s*\{[\s\S]*?overflow:\s*hidden/,
    );
  });

  it("makes the page stage wrapper transparent", () => {
    expect(page).toMatch(
      /\.today-page__stage\s*\{[\s\S]*?background:\s*transparent/,
    );
  });

  it("stacks countdown above status at 860 pixels", () => {
    expect(cockpit).toMatch(
      /@media\s*\(max-width:\s*860px\)[\s\S]*?\.status-cockpit\s*\{[\s\S]*?grid-template-columns:\s*1fr/,
    );
  });
});
```

- [ ] **Step 2: Run the CSS-contract test and verify it fails**

Run:

```bash
npm test -- src/features/today/statusCockpitLayout.test.ts
```

Expected: FAIL because the current ratio is `1.45fr / 0.72fr`, the blue background is owned by `today-page__stage`, and the work panel has no clipping surface.

- [ ] **Step 3: Move the blue surface into the work panel**

Replace the leading layout rules in `src/features/today/StatusCockpit.css` with:

```css
.status-cockpit {
  display: grid;
  grid-template-columns: minmax(0, 2.15fr) minmax(285px, 1fr);
  align-items: stretch;
  gap: 4px;
  min-width: 0;
  padding: 4px;
  overflow: hidden;
  border-radius: 8px;
  background: var(--color-anchor);
  box-shadow: var(--shadow-stage);
}

.status-cockpit__work {
  position: relative;
  display: grid;
  align-content: stretch;
  min-width: 0;
  min-height: 390px;
  padding: 16px;
  overflow: hidden;
  color: #fff;
  background: var(--color-stage);
}

.status-cockpit__reaction {
  position: relative;
  display: grid;
  align-content: space-between;
  gap: 12px;
  min-width: 0;
  min-height: 390px;
  padding: 16px;
  overflow: hidden;
  color: var(--color-anchor);
  background: var(--color-reaction);
}
```

Keep the existing status-row, meme, mascot, speech, skeleton, animation, and reduced-motion rules. In the existing `@media (max-width: 860px)` block, use:

```css
@media (max-width: 860px) {
  .status-cockpit {
    grid-template-columns: 1fr;
  }

  .status-cockpit__work {
    min-height: 330px;
  }

  .status-cockpit__reaction {
    min-height: 270px;
  }

  .status-cockpit__meme {
    min-height: 210px;
  }

  .status-cockpit__meme-mark {
    font-size: clamp(7.5rem, 38vw, 10rem);
  }

  .status-cockpit__speech p {
    font-size: clamp(1.0625rem, 4.8vw, 1.1875rem);
  }
}
```

- [ ] **Step 4: Make the TodayPage stage wrapper layout-only**

Update `.today-page__stage` in `src/pages/TodayPage.css` to:

```css
.today-page__stage {
  grid-area: stage;
  min-width: 0;
  min-height: 0;
  padding: 0;
  overflow: visible;
  border: 0;
  border-radius: 0;
  color: inherit;
  background: transparent;
  box-shadow: none;
}
```

Remove the `.today-page__stage::after` decoration because the LIVE label already belongs inside the blue countdown panel. Keep `.today-page__stage > *`, the overtime/decision normalization, and the rest of the page dashboard rules.

- [ ] **Step 5: Update the color-system ownership assertion**

In `src/styles/colorSystem.test.ts`, replace the `page` constant and the first expectation in `keeps the cockpit blue, reaction coral, and meme sticker yellow` so the complete test starts with:

```ts
it("keeps the cockpit blue, reaction coral, and meme sticker yellow", () => {
  const cockpit = readSource("src/features/today/StatusCockpit.css");
  const tools = readSource("src/features/today/WorkScheduleEditor.css");

  expect(cockpit).toMatch(
    /\.status-cockpit__work[\s\S]*?background:\s*var\(--color-stage\)/,
  );
  expect(cockpit).toMatch(
    /\.status-cockpit__reaction[\s\S]*?background:\s*var\(--color-reaction\)/,
  );
  expect(cockpit).toMatch(
    /\.status-cockpit__speech[\s\S]*?background:\s*var\(--color-signal\)/,
  );
  expect(tools).toMatch(
    /\.work-schedule-editor[\s\S]*?background:\s*var\(--color-anchor\)/,
  );
});
```

- [ ] **Step 6: Run the layout and color-system tests**

Run:

```bash
npm test -- src/features/today/statusCockpitLayout.test.ts src/styles/colorSystem.test.ts
```

Expected: all layout and color-system tests PASS.

- [ ] **Step 7: Commit the layout styles**

```bash
git add src/features/today/StatusCockpit.css src/features/today/statusCockpitLayout.test.ts src/pages/TodayPage.css src/styles/colorSystem.test.ts
git commit -m "feat: split countdown and status dashboard panels"
```

### Task 3: Full Verification and App Restart

**Files:**
- Verify only; no planned source changes.

- [ ] **Step 1: Run the frontend test suite**

Run:

```bash
npm test
```

Expected: all Vitest tests PASS.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build successfully.

- [ ] **Step 3: Review the intended diff without overwriting existing work**

Run:

```bash
git diff --check
git diff -- src/features/today/StatusCockpit.tsx src/features/today/StatusCockpit.css src/features/today/StatusCockpit.test.tsx src/features/today/statusCockpitLayout.test.ts src/pages/TodayPage.css src/styles/colorSystem.test.ts
```

Expected: the new changes only introduce semantic sibling panels, the 68/32 split, panel-specific surfaces and clipping, mobile stacking, and aligned tests. Preserve all unrelated pre-existing edits in these already-modified or untracked files.

- [ ] **Step 4: Restart the Tauri development app**

Stop the existing `npm run tauri dev` process group, then run:

```bash
npm run tauri dev
```

Expected: Vite reports `Local: http://localhost:1420/`, Rust starts `target/debug/work-shackle`, and the desktop app opens with blue and orange panels side by side and no overlap.
