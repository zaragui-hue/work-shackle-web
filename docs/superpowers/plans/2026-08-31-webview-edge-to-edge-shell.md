# Work Shackle WebView Edge-to-Edge Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the dark outer picture frame by making the normal Work Shackle shell fill the entire WebView below the native macOS title bar.

**Architecture:** Keep the existing React and Tauri structure unchanged. Make the document root a full-height paper canvas, convert the default `.ws-shell` from a centered decorative panel into an edge-to-edge layout surface, and protect the normal and narrow layouts with a source-based CSS contract test while preserving the current sticky-header and fullscreen rules.

**Tech Stack:** CSS, Vitest, Node file APIs, TypeScript, Vite

---

### Task 1: Specify the edge-to-edge shell contract

**Files:**
- Create: `src/shared/shell/appShellEdgeToEdge.test.ts`
- Read: `src/styles/base.css`
- Read: `src/shared/shell/AppShell.css`

- [ ] **Step 1: Write the failing CSS contract test**

Create `src/shared/shell/appShellEdgeToEdge.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const baseCss = readFileSync(
  join(process.cwd(), "src/styles/base.css"),
  "utf8",
);
const shellCss = readFileSync(
  join(process.cwd(), "src/shared/shell/AppShell.css"),
  "utf8",
);

describe("AppShell edge-to-edge layout", () => {
  it("uses the paper canvas across the complete WebView", () => {
    expect(baseCss).toMatch(
      /html,\s*body,\s*#root\s*\{[^}]*min-height:\s*100%/,
    );
    expect(baseCss).toMatch(
      /body\s*\{[^}]*background-color:\s*var\(--color-paper\)/,
    );
    expect(baseCss).not.toMatch(/body\s*\{[^}]*background-image:/);
  });

  it("fills the normal window without an outer panel frame", () => {
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*min-height:\s*100dvh/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*width:\s*100%/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*max-width:\s*none/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*margin:\s*0/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*border:\s*0/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*border-radius:\s*0/);
    expect(shellCss).toMatch(/\.ws-shell\s*\{[^}]*box-shadow:\s*none/);
  });

  it("does not restore the picture frame at the narrow breakpoint", () => {
    const narrowShell = shellCss.match(
      /@media\s*\(max-width:\s*720px\)\s*\{[\s\S]*?\.ws-shell\s*\{([^}]*)\}/,
    )?.[1];

    expect(narrowShell).toBeDefined();
    expect(narrowShell).not.toMatch(/width:/);
    expect(narrowShell).not.toMatch(/margin:/);
    expect(narrowShell).not.toMatch(/border-radius:/);
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/shared/shell/appShellEdgeToEdge.test.ts`

Expected: FAIL because the body still paints a dark dotted background, the normal shell is centered and width-limited, and the narrow breakpoint restores outer spacing and rounding.

### Task 2: Convert the document root and shell to an edge-to-edge canvas

**Files:**
- Modify: `src/styles/base.css`
- Modify: `src/shared/shell/AppShell.css`
- Test: `src/shared/shell/appShellEdgeToEdge.test.ts`
- Preserve: `src/shared/shell/appShellStickyHeader.test.ts`
- Preserve: `src/shared/shell/fullscreenShellLayout.test.ts`

- [ ] **Step 1: Replace the global dark dotted frame with the paper canvas**

In `src/styles/base.css`, keep the existing reset and typography declarations, but replace the `body` background declarations with:

```css
html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--color-ink);
  background-color: var(--color-paper);
  -webkit-font-smoothing: antialiased;
}
```

Remove only the global `background-image` and `background-size` declarations. Component-owned textures, including reminder and startup views, remain untouched.

- [ ] **Step 2: Make the default shell fill the WebView**

In the existing `.ws-shell` declaration in `src/shared/shell/AppShell.css`, preserve its grid, padding, clipping, color, and background declarations. Replace only the outer-panel layout and decoration with:

```css
.ws-shell {
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr;
  width: 100%;
  max-width: none;
  margin: 0;
  padding: 18px 20px 14px;
  overflow: clip;
  border: 0;
  border-radius: 0;
  color: var(--color-ink);
  background: var(--color-paper);
  box-shadow: none;
}
```

Do not modify `.ws-shell__brand`; its current sticky position, z-index, and shadow belong to the in-progress header work and must remain intact.

- [ ] **Step 3: Prevent the narrow breakpoint from recreating the frame**

Replace the narrow `.ws-shell` override with padding only:

```css
@media (max-width: 720px) {
  .ws-shell {
    padding: 12px;
  }

  /* Keep all existing brand, header action, and navigation declarations below. */
}
```

Remove the narrow shell's `width`, `min-height`, `margin`, and `border-radius` declarations. Do not change the responsive behavior of the header or navigation.

- [ ] **Step 4: Run focused shell verification**

Run: `npm test -- src/shared/shell/appShellEdgeToEdge.test.ts src/shared/shell/appShellStickyHeader.test.ts src/shared/shell/fullscreenShellLayout.test.ts`

Expected: all focused tests PASS, proving that the default window is edge-to-edge while sticky-header and fullscreen contracts remain valid.

### Task 3: Verify no behavior or build regressions

**Files:**
- Verify: `src/styles/base.css`
- Verify: `src/shared/shell/AppShell.css`
- Verify: `src/shared/shell/appShellEdgeToEdge.test.ts`

- [ ] **Step 1: Run the complete frontend test suite**

Run: `npm test`

Expected: all tests PASS. No task, settings, reminder, Today page, navigation, or fullscreen behavior changes.

- [ ] **Step 2: Run the production frontend build**

Run: `npm run build`

Expected: TypeScript compilation and the Vite production build PASS.

- [ ] **Step 3: Inspect scope and whitespace**

Run: `git diff --check`

Expected: no whitespace errors.

Run: `git diff -- src/styles/base.css src/shared/shell/AppShell.css src/shared/shell/appShellEdgeToEdge.test.ts`

Expected: the diff contains only the global canvas change, shell outer-frame removal, narrow breakpoint correction, and the new contract test. The pre-existing sticky-header declarations remain present.

- [ ] **Step 4: Commit only the edge-to-edge repair**

```bash
git add src/styles/base.css src/shared/shell/AppShell.css src/shared/shell/appShellEdgeToEdge.test.ts
git commit -m "fix: remove desktop shell outer frame"
```

Expected: the commit includes the new test and the two targeted stylesheet changes, without staging unrelated existing work.
