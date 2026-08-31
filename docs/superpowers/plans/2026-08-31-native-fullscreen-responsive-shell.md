# Native Fullscreen Responsive Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the app shell fill the entire native fullscreen viewport and expose an accessible exit-fullscreen button that stays synchronized with the Tauri window state.

**Architecture:** Add a focused `useWindowFullscreen` hook around the Tauri window API, then let `AppShell` render a state class and conditional exit control. Keep fullscreen-only layout overrides in a new stylesheet loaded after the existing shell CSS so the user's uncommitted sticky-header changes remain untouched.

**Tech Stack:** React 19, TypeScript, Tauri 2 window API, CSS, Vitest, Testing Library, Vite

---

### Task 1: Specify native fullscreen state behavior

**Files:**
- Create: `src/shared/shell/useWindowFullscreen.test.tsx`
- Create: `src/shared/shell/useWindowFullscreen.ts`

- [x] **Step 1: Write failing hook tests**

Create tests with a mocked Tauri-window adapter that cover initial fullscreen state, resize-driven synchronization, exit behavior, and API failure fallback:

```tsx
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useWindowFullscreen, type FullscreenWindow } from "./useWindowFullscreen";

afterEach(cleanup);

describe("useWindowFullscreen", () => {
  it("syncs native fullscreen changes and exits through the window API", async () => {
    let fullscreen = true;
    let onResize: (() => void) | undefined;
    const windowRef: FullscreenWindow = {
      isFullscreen: vi.fn(async () => fullscreen),
      onResized: vi.fn(async (handler) => {
        onResize = () => handler({} as never);
        return vi.fn();
      }),
      setFullscreen: vi.fn(async (next) => {
        fullscreen = next;
      }),
    };

    const { result } = renderHook(() => useWindowFullscreen(windowRef));
    await waitFor(() => expect(result.current.isFullscreen).toBe(true));

    fullscreen = false;
    await act(async () => onResize?.());
    await waitFor(() => expect(result.current.isFullscreen).toBe(false));

    fullscreen = true;
    await act(async () => onResize?.());
    await waitFor(() => expect(result.current.isFullscreen).toBe(true));

    await act(async () => result.current.exitFullscreen());
    expect(windowRef.setFullscreen).toHaveBeenCalledWith(false);
    expect(result.current.isFullscreen).toBe(false);
  });

  it("falls back to windowed layout when native state is unavailable", async () => {
    const windowRef: FullscreenWindow = {
      isFullscreen: vi.fn(async () => { throw new Error("unavailable"); }),
      onResized: vi.fn(async () => { throw new Error("unavailable"); }),
      setFullscreen: vi.fn(async () => { throw new Error("unavailable"); }),
    };

    const { result } = renderHook(() => useWindowFullscreen(windowRef));
    await waitFor(() => expect(windowRef.isFullscreen).toHaveBeenCalled());
    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.exiting).toBe(false);
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run: `npm test -- src/shared/shell/useWindowFullscreen.test.tsx`

Expected: FAIL because the hook module does not exist.

- [x] **Step 3: Implement the native window hook**

Create a small adapter type and synchronize state from `isFullscreen()` after mount and every resize:

```tsx
import { getCurrentWindow, type Window as TauriWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";

export type FullscreenWindow = Pick<
  TauriWindow,
  "isFullscreen" | "onResized" | "setFullscreen"
>;

export function useWindowFullscreen(
  windowRef?: FullscreenWindow,
) {
  const [resolvedWindow] = useState<FullscreenWindow | null>(
    () => windowRef ?? resolveCurrentWindow(),
  );
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!resolvedWindow) return undefined;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    const sync = async () => {
      try {
        const next = await resolvedWindow.isFullscreen();
        if (!disposed) setIsFullscreen(next);
      } catch {
        if (!disposed) setIsFullscreen(false);
      }
    };

    void sync();
    void resolvedWindow.onResized(() => void sync()).then((cleanup) => {
      if (disposed) cleanup();
      else unlisten = cleanup;
    }).catch(() => undefined);

    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [resolvedWindow]);

  const exitFullscreen = useCallback(async () => {
    if (exiting || !resolvedWindow) return;
    setExiting(true);
    try {
      await resolvedWindow.setFullscreen(false);
      setIsFullscreen(await resolvedWindow.isFullscreen());
    } catch {
      // Preserve the last confirmed native state.
    } finally {
      setExiting(false);
    }
  }, [exiting, resolvedWindow]);

  return { isFullscreen, exiting, exitFullscreen };
}

function resolveCurrentWindow(): FullscreenWindow | null {
  try {
    return getCurrentWindow();
  } catch {
    return null;
  }
}
```

- [x] **Step 4: Run the hook tests**

Run: `npm test -- src/shared/shell/useWindowFullscreen.test.tsx`

Expected: PASS for synchronization, exit behavior, and fallback.

### Task 2: Render the fullscreen class and exit control

**Files:**
- Modify: `src/shared/shell/AppShell.tsx`
- Create: `src/shared/shell/fullscreenShellStructure.test.ts`

- [x] **Step 1: Add a failing source-contract test**

Verify that `AppShell` consumes the hook, applies the modifier class, and exposes an exit button only in fullscreen:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(join(process.cwd(), "src/shared/shell/AppShell.tsx"), "utf8");

describe("AppShell fullscreen structure", () => {
  it("binds native fullscreen state to the shell and exit control", () => {
    expect(source).toContain("useWindowFullscreen()");
    expect(source).toContain("ws-shell--fullscreen");
    expect(source).toContain('aria-label="退出全屏"');
    expect(source).toContain("exitFullscreen");
  });
});
```

- [x] **Step 2: Run the structure test and verify it fails**

Run: `npm test -- src/shared/shell/fullscreenShellStructure.test.ts`

Expected: FAIL because AppShell has no fullscreen state or exit button.

- [x] **Step 3: Integrate the hook and button**

Import the hook and fullscreen stylesheet. In `AppShellContent`, add:

```tsx
const { isFullscreen, exiting, exitFullscreen } = useWindowFullscreen();
```

Apply the root class and render the conditional control before the live-status badge:

```tsx
<div className={`ws-shell${isFullscreen ? " ws-shell--fullscreen" : ""}`}>
  {/* ... */}
  {isFullscreen ? (
    <button
      type="button"
      className="ws-shell__fullscreen-exit"
      aria-label="退出全屏"
      disabled={exiting}
      onClick={() => void exitFullscreen()}
    >
      <FullscreenExitIcon />
      <span>{exiting ? "正在退出" : "退出全屏"}</span>
    </button>
  ) : null}
```

Add a local `FullscreenExitIcon` SVG component whose icon is `aria-hidden`.

- [x] **Step 4: Run the structure and hook tests**

Run: `npm test -- src/shared/shell/fullscreenShellStructure.test.ts src/shared/shell/useWindowFullscreen.test.tsx`

Expected: PASS.

### Task 3: Add isolated fullscreen layout styling

**Files:**
- Create: `src/shared/shell/AppShellFullscreen.css`
- Create: `src/shared/shell/fullscreenShellLayout.test.ts`

- [x] **Step 1: Write the failing CSS contract test**

Read the new stylesheet and assert the required full-viewport surface and flexible Today-page columns:

```ts
expect(css).toMatch(/\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*width:\s*100%/);
expect(css).toMatch(/\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*min-height:\s*100dvh/);
expect(css).toMatch(/\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*max-width:\s*none/);
expect(css).toMatch(/\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*margin:\s*0/);
expect(css).toMatch(/\.ws-shell\.ws-shell--fullscreen\s*\{[^}]*border-radius:\s*0/);
expect(css).toMatch(/\.ws-shell--fullscreen\s+\.today-page__dashboard[\s\S]*?clamp\(340px,\s*22vw,\s*460px\)/);
```

- [x] **Step 2: Run the CSS contract test and verify it fails**

Run: `npm test -- src/shared/shell/fullscreenShellLayout.test.ts`

Expected: FAIL because the stylesheet does not exist.

- [x] **Step 3: Implement the fullscreen surface and button style**

Create the independent override stylesheet:

```css
.ws-shell.ws-shell--fullscreen {
  width: 100%;
  max-width: none;
  min-height: 100dvh;
  margin: 0;
  padding: clamp(12px, 1.4vw, 28px);
  border: 0;
  border-radius: 0;
  box-shadow: none;
}

.ws-shell--fullscreen .today-page__dashboard {
  grid-template-columns: minmax(0, 1fr) clamp(340px, 22vw, 460px);
}

.ws-shell__fullscreen-exit {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 13px;
  border: 2px solid var(--color-anchor);
  border-radius: 3px;
  color: var(--color-signal);
  background: var(--color-anchor);
  box-shadow: 3px 3px 0 var(--color-danger);
  font-size: var(--font-size-nav);
  font-weight: 900;
  white-space: nowrap;
}
```

Add hover, active, focus-visible, disabled, icon, and small-width rules. At `max-width: 760px`, restore the existing single-column Today dashboard rather than forcing the wide-screen column rule.

- [x] **Step 4: Run the fullscreen layout tests**

Run: `npm test -- src/shared/shell/fullscreenShellLayout.test.ts src/shared/shell/fullscreenShellStructure.test.ts`

Expected: PASS.

### Task 4: Enable the native exit permission

**Files:**
- Create: `src-tauri/capabilities/fullscreen.json`
- Create: `src/shared/shell/fullscreenPermission.test.ts`

- [x] **Step 1: Write a failing permission test**

Parse the capability JSON and assert:

```ts
expect(capability.permissions).toContain("core:window:allow-set-fullscreen");
```

- [x] **Step 2: Run the permission test and verify it fails**

Run: `npm test -- src/shared/shell/fullscreenPermission.test.ts`

Expected: FAIL because the permission is not listed.

- [x] **Step 3: Add the minimum permission**

Create a focused `main-window-fullscreen` capability that targets only the `main` window and grants only `core:window:allow-set-fullscreen`. Keep the shared default capability for the main and reminder windows unchanged.

- [x] **Step 4: Run the permission test**

Run: `npm test -- src/shared/shell/fullscreenPermission.test.ts`

Expected: PASS.

### Task 5: Verify fullscreen and windowed layouts

**Files:**
- Verify: `src/shared/shell/AppShell.tsx`
- Verify: `src/shared/shell/AppShellFullscreen.css`
- Verify: `src/shared/shell/useWindowFullscreen.ts`
- Verify: `src-tauri/capabilities/fullscreen.json`

- [x] **Step 1: Run focused tests**

Run: `npm test -- src/shared/shell/useWindowFullscreen.test.tsx src/shared/shell/fullscreenShellStructure.test.ts src/shared/shell/fullscreenShellLayout.test.ts src/shared/shell/fullscreenPermission.test.ts`

Expected: PASS.

- [x] **Step 2: Run the full frontend test suite**

Run: `npm test`

Expected: all Vitest files pass.

- [x] **Step 3: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete successfully.

- [x] **Step 4: Perform visual responsive checks**

Use the development preview with a temporary fullscreen class fixture at a wide desktop viewport and the ordinary preview at 1280px. Confirm:

```text
- fullscreen shell reaches all four viewport edges;
- no horizontal scroll appears;
- Today-page control column grows within 340–460px;
- exit button fits before the status and navigation controls;
- normal window keeps its centered outer frame;
- 760px and below retain the single-column layout.
```
