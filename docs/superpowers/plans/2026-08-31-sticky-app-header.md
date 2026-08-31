# Sticky App Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the full “精神状态事务所” header, current status, and main navigation visible while page content scrolls.

**Architecture:** Implement the behavior entirely in the shared AppShell stylesheet so the production shell and design preview remain identical. Use native CSS sticky positioning, replace the shell overflow mode that blocks sticky ancestors, and protect the contract with a source-based style test.

**Tech Stack:** CSS, Vitest, Node file APIs.

---

### Task 1: Add the sticky-header style contract

**Files:**
- Create: `src/shared/shell/appShellStickyHeader.test.ts`
- Modify: `src/shared/shell/AppShell.css`

- [ ] **Step 1: Write the failing style test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./AppShell.css", import.meta.url), "utf8");

describe("AppShell sticky header", () => {
  it("keeps the complete brand row pinned above scrolling content", () => {
    expect(css).toMatch(/\.ws-shell\s*{[\s\S]*?overflow:\s*clip/);
    expect(css).toMatch(/\.ws-shell__brand\s*{[\s\S]*?position:\s*sticky/);
    expect(css).toMatch(/\.ws-shell__brand\s*{[\s\S]*?top:\s*0/);
    expect(css).toMatch(/\.ws-shell__brand\s*{[\s\S]*?z-index:\s*30/);
  });
});
```

- [ ] **Step 2: Run the test and verify failure**

Run: `npm test -- --run src/shared/shell/appShellStickyHeader.test.ts`
Expected: FAIL because the shell still uses hidden overflow and the brand row is not sticky.

- [ ] **Step 3: Implement native sticky positioning**

```css
.ws-shell {
  overflow: clip;
}

.ws-shell__brand {
  position: sticky;
  z-index: 30;
  top: 0;
  box-shadow: 0 8px 18px rgba(27, 35, 63, 0.16);
}
```

Keep all existing grid, padding, color, and responsive declarations unchanged.

- [ ] **Step 4: Run focused and full verification**

Run: `npm test -- --run src/shared/shell/appShellStickyHeader.test.ts src/shared/shell/AppNavigation.test.tsx`
Expected: PASS.

Run: `npm test`
Expected: all tests PASS.

Run: `npm run build`
Expected: TypeScript and Vite build PASS.

- [ ] **Step 5: Inspect the final diff**

Run: `git diff --check` and `git status --short`.
Expected: no whitespace errors; existing feature changes remain intact.
