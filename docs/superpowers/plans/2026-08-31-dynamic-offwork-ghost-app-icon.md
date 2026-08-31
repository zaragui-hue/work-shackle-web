# Dynamic Offwork Ghost App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic Work Shackle icon with the approved “下班小鬼” brand icon and switch the running desktop icon among six deterministic time/DDL/overtime states.

**Architecture:** Keep visual generation, state resolution, data snapshot assembly, and native icon application independent. A React hook mounted once in `AppShell` refreshes on aligned minute boundaries, app focus, visibility changes, and explicit frontend mutation events; a pure resolver owns all priority rules, while a thin controller fetches the bundled PNG and calls Tauri only when the resolved state changes.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, Vitest/jsdom, Tauri 2 window API, Node.js icon-generation script, Tauri CLI icon generator.

---

## File map

Create:

- `src/features/app-icon/dynamicAppIconState.ts` — state enum, resolver input, priority and time boundaries.
- `src/features/app-icon/dynamicAppIconState.test.ts` — exhaustive resolver boundary tests.
- `src/features/app-icon/dynamicAppIconSnapshot.ts` — convert tasks/schedule/status/overtime facts into resolver input.
- `src/features/app-icon/dynamicAppIconSnapshot.test.ts` — actionable-task filtering, nearest DDL and work-end parsing tests.
- `src/features/app-icon/dynamicAppIconAssets.ts` — typed map from state to bundled 1024px PNG URL.
- `src/features/app-icon/dynamicAppIconAssets.test.ts` — asset-key and uniqueness contract.
- `src/features/app-icon/appIconController.ts` — PNG loading and Tauri `setIcon` adapter.
- `src/features/app-icon/appIconController.test.ts` — byte loading, application and failure tests.
- `src/features/app-icon/useDynamicAppIcon.ts` — lifecycle orchestration, aligned-minute timer and dedupe.
- `src/features/app-icon/useDynamicAppIcon.test.tsx` — initial load, event/focus refresh, dedupe, retry and web no-op tests.
- `src/services/tauri/dynamicAppIconEvents.ts` — one browser event shared by successful frontend mutations.
- `src/services/tauri/dynamicAppIconMutationEvents.test.ts` — service-level mutation refresh contract.
- `src/assets/app-icons/offwork-ghost/svg/*.svg` — six deterministic SVG masters generated from one script.
- `src/assets/app-icons/offwork-ghost/runtime/*.png` — six 1024px runtime PNGs.
- `public/offwork-ghost.svg` — permanent web favicon generated from the default master.
- `scripts/generate-offwork-ghost-icons.mjs` — single source for all SVG masters, runtime PNGs and bundle icons.

Modify:

- `src/shared/shell/AppShell.tsx` — mount the icon hook once beside the existing work-status context.
- `src/services/tauri/tasks.ts` — dispatch refresh after successful task mutations.
- `src/services/tauri/settings.ts` — dispatch refresh after successful work-time mutations.
- `src/services/tauri/overtime.ts` — dispatch refresh after successful overtime mutations.
- `src/services/tauri/workStatus.ts` — dispatch refresh after successful status switches.
- `src-tauri/Cargo.toml` — enable Tauri PNG decoding.
- `src-tauri/capabilities/default.json` — allow `core:window:allow-set-icon` for the main window.
- `src-tauri/icons/*` — replace current generic bundle icons with generated default ghost art.
- `index.html` — replace the Vite favicon with the generated ghost SVG.
- `package.json` — add repeatable icon generation and validation scripts.

## Task 1: Pure dynamic-icon state resolver

**Files:**

- Create: `src/features/app-icon/dynamicAppIconState.test.ts`
- Create: `src/features/app-icon/dynamicAppIconState.ts`

- [ ] **Step 1: Write the failing resolver tests**

```ts
import { describe, expect, it } from "vitest";

import { resolveDynamicAppIconState } from "./dynamicAppIconState";

function at(hour: number, minute = 0): number {
  return new Date(2026, 7, 31, hour, minute, 0, 0).getTime();
}

describe("resolveDynamicAppIconState", () => {
  it.each([
    [at(9, 59), "morning"],
    [at(10), "default"],
    [at(13, 59), "default"],
    [at(14), "afternoon"],
  ] as const)("maps ordinary time %s to %s", (nowMs, expected) => {
    expect(resolveDynamicAppIconState({ nowMs })).toBe(expected);
  });

  it("starts the off-work reward exactly thirty minutes before work ends", () => {
    expect(resolveDynamicAppIconState({ nowMs: at(17, 29), workEndAtMs: at(18) }))
      .toBe("afternoon");
    expect(resolveDynamicAppIconState({ nowMs: at(17, 30), workEndAtMs: at(18) }))
      .toBe("offwork_soon");
  });

  it("starts the alert exactly thirty minutes before the nearest actionable DDL", () => {
    expect(resolveDynamicAppIconState({ nowMs: at(16), nearestDeadlineAtMs: at(16, 31) }))
      .toBe("afternoon");
    expect(resolveDynamicAppIconState({ nowMs: at(16), nearestDeadlineAtMs: at(16, 30) }))
      .toBe("deadline_alert");
    expect(resolveDynamicAppIconState({ nowMs: at(16), nearestDeadlineAtMs: at(15) }))
      .toBe("deadline_alert");
  });

  it("uses deadline over overtime and overtime over off-work-soon", () => {
    expect(resolveDynamicAppIconState({
      nowMs: at(17, 45),
      workEndAtMs: at(18),
      activeOvertime: true,
      nearestDeadlineAtMs: at(18),
    })).toBe("deadline_alert");
    expect(resolveDynamicAppIconState({
      nowMs: at(17, 45),
      workEndAtMs: at(18),
      activeOvertime: true,
    })).toBe("overtime");
  });

  it("uses explicit working state after work end as overtime", () => {
    expect(resolveDynamicAppIconState({
      nowMs: at(18),
      workEndAtMs: at(18),
      isWorking: true,
    })).toBe("overtime");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/features/app-icon/dynamicAppIconState.test.ts`

Expected: FAIL because `dynamicAppIconState.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure resolver**

```ts
export const DYNAMIC_APP_ICON_STATES = [
  "morning",
  "default",
  "afternoon",
  "offwork_soon",
  "deadline_alert",
  "overtime",
] as const;

export type DynamicAppIconState = (typeof DYNAMIC_APP_ICON_STATES)[number];

export type DynamicAppIconSnapshot = {
  nowMs: number;
  workEndAtMs?: number;
  activeOvertime?: boolean;
  isWorking?: boolean;
  nearestDeadlineAtMs?: number;
};

const THIRTY_MINUTES_MS = 30 * 60 * 1000;

export function resolveDynamicAppIconState(
  snapshot: DynamicAppIconSnapshot,
): DynamicAppIconState {
  const { nowMs, workEndAtMs, nearestDeadlineAtMs } = snapshot;
  if (
    nearestDeadlineAtMs != null
    && nearestDeadlineAtMs - nowMs <= THIRTY_MINUTES_MS
  ) {
    return "deadline_alert";
  }
  if (
    snapshot.activeOvertime
    || (snapshot.isWorking && workEndAtMs != null && nowMs >= workEndAtMs)
  ) {
    return "overtime";
  }
  if (
    workEndAtMs != null
    && nowMs < workEndAtMs
    && workEndAtMs - nowMs <= THIRTY_MINUTES_MS
  ) {
    return "offwork_soon";
  }
  const hour = new Date(nowMs).getHours();
  if (hour < 10) return "morning";
  if (hour < 14) return "default";
  return "afternoon";
}
```

- [ ] **Step 4: Run the resolver tests**

Run: `npm test -- src/features/app-icon/dynamicAppIconState.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the resolver**

```bash
git add src/features/app-icon/dynamicAppIconState.ts src/features/app-icon/dynamicAppIconState.test.ts
git commit -m "feat: resolve dynamic app icon state"
```

## Task 2: Snapshot assembly from existing business facts

**Files:**

- Create: `src/features/app-icon/dynamicAppIconSnapshot.test.ts`
- Create: `src/features/app-icon/dynamicAppIconSnapshot.ts`

- [ ] **Step 1: Write failing snapshot tests**

```ts
import { describe, expect, it } from "vitest";

import type { Task } from "../../services/tauri/tasks";
import { buildDynamicAppIconSnapshot } from "./dynamicAppIconSnapshot";

const nowMs = new Date(2026, 7, 31, 17, 0).getTime();
const task = (id: string, deadlineAtMs: number, status: Task["status"]): Task => ({
  id,
  title: id,
  plannedAtMs: nowMs - 1_000,
  deadlineAtMs,
  priority: 2,
  status,
  createdAtMs: nowMs - 2_000,
  updatedAtMs: nowMs - 1_000,
});

describe("buildDynamicAppIconSnapshot", () => {
  it("selects the nearest actionable deadline and excludes paused/terminal tasks", () => {
    const result = buildDynamicAppIconSnapshot({
      nowMs,
      tasks: [
        task("later", nowMs + 20_000, "waiting"),
        task("paused", nowMs - 50_000, "paused"),
        task("done", nowMs - 60_000, "completed"),
        task("nearest", nowMs + 10_000, "in_progress"),
      ],
      schedule: null,
      activeOvertime: null,
      currentStatus: null,
    });
    expect(result.nearestDeadlineAtMs).toBe(nowMs + 10_000);
  });

  it("parses the configured local work end and current work fact", () => {
    const result = buildDynamicAppIconSnapshot({
      nowMs,
      tasks: [],
      schedule: {
        workDate: "2026-08-31",
        defaultStart: "09:00",
        defaultEnd: "18:00",
        effectiveStart: "09:30",
        effectiveEnd: "18:30",
        hasTodayOverride: true,
      },
      activeOvertime: null,
      currentStatus: {
        recordId: "status-1",
        statusType: "meeting",
        emoji: "💻",
        name: "会议中",
        displayCopy: "meeting",
        workDate: "2026-08-31",
        startAtMs: nowMs - 1_000,
      },
    });
    expect(result.workEndAtMs).toBe(new Date(2026, 7, 31, 18, 30).getTime());
    expect(result.isWorking).toBe(true);
    expect(result.activeOvertime).toBe(false);
  });

  it("keeps weekends on ordinary time unless overtime is explicit", () => {
    const saturday = new Date(2026, 8, 5, 17, 45).getTime();
    const result = buildDynamicAppIconSnapshot({
      nowMs: saturday,
      tasks: [],
      schedule: {
        workDate: "2026-09-05",
        defaultStart: "09:00",
        defaultEnd: "18:00",
        effectiveStart: "09:00",
        effectiveEnd: "18:00",
        hasTodayOverride: false,
      },
      activeOvertime: null,
      currentStatus: null,
    });
    expect(result.workEndAtMs).toBeUndefined();
    expect(result.isWorking).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- src/features/app-icon/dynamicAppIconSnapshot.test.ts`

Expected: FAIL because the snapshot module does not exist.

- [ ] **Step 3: Implement snapshot assembly**

```ts
import type { ActiveOvertime } from "../../services/tauri/overtime";
import type { WorkSchedule } from "../../services/tauri/settings";
import type { Task } from "../../services/tauri/tasks";
import type { CurrentWorkStatus } from "../../services/tauri/workStatus";
import { parseClockTimeOnDate } from "../today/workCountdown";
import type { DynamicAppIconSnapshot } from "./dynamicAppIconState";

const ACTIONABLE_STATUSES = new Set<Task["status"]>([
  "not_started",
  "in_progress",
  "waiting",
]);

export type DynamicAppIconFacts = {
  nowMs: number;
  tasks: Task[];
  schedule: WorkSchedule | null;
  activeOvertime: ActiveOvertime | null;
  currentStatus: CurrentWorkStatus | null;
};

export function buildDynamicAppIconSnapshot(
  facts: DynamicAppIconFacts,
): DynamicAppIconSnapshot {
  const scheduleDay = facts.schedule
    ? parseClockTimeOnDate(facts.schedule.workDate, "12:00").getDay()
    : null;
  const ordinaryWorkday = scheduleDay != null && scheduleDay !== 0 && scheduleDay !== 6;
  const deadlines = facts.tasks
    .filter((task) => ACTIONABLE_STATUSES.has(task.status))
    .flatMap((task) => task.deadlineAtMs == null ? [] : [task.deadlineAtMs]);
  return {
    nowMs: facts.nowMs,
    workEndAtMs: facts.schedule && ordinaryWorkday
      ? parseClockTimeOnDate(
        facts.schedule.workDate,
        facts.schedule.effectiveEnd,
      ).getTime()
      : undefined,
    activeOvertime: facts.activeOvertime != null,
    isWorking: facts.currentStatus != null && ordinaryWorkday,
    nearestDeadlineAtMs: deadlines.length > 0 ? Math.min(...deadlines) : undefined,
  };
}
```

- [ ] **Step 4: Run snapshot and resolver tests**

Run: `npm test -- src/features/app-icon/dynamicAppIconSnapshot.test.ts src/features/app-icon/dynamicAppIconState.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit snapshot assembly**

```bash
git add src/features/app-icon/dynamicAppIconSnapshot.ts src/features/app-icon/dynamicAppIconSnapshot.test.ts
git commit -m "feat: build dynamic app icon snapshot"
```

## Task 3: Deterministic “下班小鬼” assets

**Files:**

- Create: `scripts/generate-offwork-ghost-icons.mjs`
- Create: `src/features/app-icon/dynamicAppIconAssets.ts`
- Create: `src/features/app-icon/dynamicAppIconAssets.test.ts`
- Generate: `src/assets/app-icons/offwork-ghost/svg/*.svg`
- Generate: `src/assets/app-icons/offwork-ghost/runtime/*.png`
- Modify: `src-tauri/icons/*`
- Modify: `index.html`
- Modify: `package.json`

- [ ] **Step 1: Add the failing asset-map contract test**

```ts
import { describe, expect, it } from "vitest";

import { DYNAMIC_APP_ICON_STATES } from "./dynamicAppIconState";
import { DYNAMIC_APP_ICON_ASSETS } from "./dynamicAppIconAssets";

describe("DYNAMIC_APP_ICON_ASSETS", () => {
  it("maps every icon state to one unique bundled PNG", () => {
    expect(Object.keys(DYNAMIC_APP_ICON_ASSETS)).toEqual(DYNAMIC_APP_ICON_STATES);
    expect(new Set(Object.values(DYNAMIC_APP_ICON_ASSETS)).size).toBe(6);
    for (const asset of Object.values(DYNAMIC_APP_ICON_ASSETS)) {
      expect(asset).toMatch(/\.png$/);
    }
  });
});
```

- [ ] **Step 2: Run the asset test to verify it fails**

Run: `npm test -- src/features/app-icon/dynamicAppIconAssets.test.ts`

Expected: FAIL because the asset module and generated files do not exist.

- [ ] **Step 3: Create the deterministic generator**

Create `scripts/generate-offwork-ghost-icons.mjs` with one shared body and six expression/background variants:

```js
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(root, "src/assets/app-icons/offwork-ghost/svg");
const runtimeDir = join(root, "src/assets/app-icons/offwork-ghost/runtime");
const bundleDir = join(root, "src-tauri/icons");
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

const variants = {
  morning: { background: "#9B83FF", body: "#FBFAFF", face: "morning" },
  default: { background: "#7557FF", body: "#FBFAFF", face: "default" },
  afternoon: { background: "#6C5A86", body: "#ECE8F4", face: "afternoon" },
  offwork_soon: { background: "#C7FF5A", body: "#FBFAFF", face: "offwork" },
  deadline_alert: { background: "#FF5E71", body: "#FBFAFF", face: "deadline" },
  overtime: { background: "#171827", body: "#B9B7C3", face: "overtime" },
};

function expression(name) {
  const ink = "#17152A";
  const common = `stroke="${ink}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"`;
  if (name === "morning") return `<path d="M330 500h90" ${common}/><ellipse cx="625" cy="510" rx="46" ry="64" fill="${ink}"/><path d="M365 665q150 105 295-10" fill="none" ${common}/>`;
  if (name === "afternoon") return `<path d="M300 510h135M585 510h135M365 670h290" ${common}/>`;
  if (name === "offwork") return `<path d="M300 490l70 48 70-48M580 490l70 48 70-48" fill="none" ${common}/><path d="M350 640q160 205 320 0" fill="#FF6D9E" ${common}/>`;
  if (name === "deadline") return `<circle cx="370" cy="510" r="85" fill="#fff" ${common}/><circle cx="650" cy="510" r="85" fill="#fff" ${common}/><circle cx="380" cy="520" r="28" fill="${ink}"/><circle cx="640" cy="520" r="28" fill="${ink}"/><ellipse cx="510" cy="700" rx="75" ry="100" fill="${ink}"/><path d="M775 410q85 75 0 155-70-75 0-155z" fill="#77DFFF" ${common}/>`;
  if (name === "overtime") return `<path d="M300 460l130 80M300 540l130-80M590 460l130 80M590 540l130-80M375 700q135-95 270 0" fill="none" ${common}/>`;
  return `<path d="M285 395q95-85 190-10M555 375q105-50 195 35" fill="none" ${common}/><ellipse cx="390" cy="510" rx="50" ry="68" fill="${ink}"/><ellipse cx="645" cy="510" rx="50" ry="68" fill="${ink}"/><path d="M365 660q150 120 305-15-25 160-165 160-115 0-140-145z" fill="#FF6D9E" ${common}/>`;
}

function renderSvg({ background, body, face }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect x="24" y="24" width="976" height="976" rx="236" fill="${background}"/>
  <circle cx="810" cy="205" r="92" fill="#C7FF5A" stroke="#17152A" stroke-width="30"/>
  <path d="M810 152v62l42 27" fill="none" stroke="#17152A" stroke-width="24" stroke-linecap="round"/>
  <path d="M190 878V470q0-315 322-315t322 315v408L720 802l-104 76-104-76-104 76-104-76z" fill="${body}" stroke="#17152A" stroke-width="38" stroke-linejoin="round"/>
  ${expression(face)}
  </svg>`;
}

mkdirSync(sourceDir, { recursive: true });
mkdirSync(runtimeDir, { recursive: true });

for (const [state, variant] of Object.entries(variants)) {
  const source = join(sourceDir, `${state}.svg`);
  writeFileSync(source, renderSvg(variant));
  const output = mkdtempSync(join(tmpdir(), `work-shackle-${state}-`));
  try {
    execFileSync(npm, ["exec", "tauri", "icon", "--", "-o", output, "-p", "1024", source], {
      cwd: root,
      stdio: "inherit",
    });
    renameSync(join(output, "1024x1024.png"), join(runtimeDir, `${state}.png`));
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
}

execFileSync(npm, ["exec", "tauri", "icon", "--", "-o", bundleDir, join(sourceDir, "default.svg")], {
  cwd: root,
  stdio: "inherit",
});
copyFileSync(join(sourceDir, "default.svg"), join(root, "public/offwork-ghost.svg"));
```

- [ ] **Step 4: Add scripts and generate all assets**

Add to `package.json`:

```json
"icons:generate": "node scripts/generate-offwork-ghost-icons.mjs"
```

Run: `npm run icons:generate`

Expected: six `runtime/*.png` files at 1024×1024, six SVG masters, and refreshed Tauri bundle icons.

- [ ] **Step 5: Add the typed runtime asset map and favicon**

```ts
import afternoon from "../../assets/app-icons/offwork-ghost/runtime/afternoon.png";
import deadlineAlert from "../../assets/app-icons/offwork-ghost/runtime/deadline_alert.png";
import defaultIcon from "../../assets/app-icons/offwork-ghost/runtime/default.png";
import morning from "../../assets/app-icons/offwork-ghost/runtime/morning.png";
import offworkSoon from "../../assets/app-icons/offwork-ghost/runtime/offwork_soon.png";
import overtime from "../../assets/app-icons/offwork-ghost/runtime/overtime.png";
import type { DynamicAppIconState } from "./dynamicAppIconState";

export const DYNAMIC_APP_ICON_ASSETS = {
  morning,
  default: defaultIcon,
  afternoon,
  offwork_soon: offworkSoon,
  deadline_alert: deadlineAlert,
  overtime,
} as const satisfies Record<DynamicAppIconState, string>;
```

Replace the favicon line in `index.html` with:

```html
<link rel="icon" type="image/svg+xml" href="/offwork-ghost.svg" />
```

- [ ] **Step 6: Run asset tests and inspect the six icons**

Run: `npm test -- src/features/app-icon/dynamicAppIconAssets.test.ts`

Expected: PASS.

Open the six PNGs as a contact sheet and verify identical body placement, safe margins, readable faces, and no clipping at 32px preview size.

- [ ] **Step 7: Commit generated assets and mapping**

```bash
git add scripts/generate-offwork-ghost-icons.mjs package.json index.html public/offwork-ghost.svg src/assets/app-icons src/features/app-icon/dynamicAppIconAssets.ts src/features/app-icon/dynamicAppIconAssets.test.ts src-tauri/icons
git commit -m "feat: add offwork ghost app icon assets"
```

## Task 4: Native icon controller and Tauri permission

**Files:**

- Create: `src/features/app-icon/appIconController.test.ts`
- Create: `src/features/app-icon/appIconController.ts`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/capabilities/default.json`

- [ ] **Step 1: Write failing controller tests**

```ts
import { describe, expect, it, vi } from "vitest";

import { applyDynamicAppIcon } from "./appIconController";

describe("applyDynamicAppIcon", () => {
  it("loads the PNG and passes bytes to the window API", async () => {
    const setIcon = vi.fn(async () => undefined);
    const fetcher = vi.fn(async () => new Response(new Uint8Array([137, 80, 78, 71])));
    await applyDynamicAppIcon("default", { setIcon }, fetcher);
    expect(setIcon).toHaveBeenCalledWith(new Uint8Array([137, 80, 78, 71]));
  });

  it("rejects failed asset loads without calling the window", async () => {
    const setIcon = vi.fn(async () => undefined);
    const fetcher = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(applyDynamicAppIcon("morning", { setIcon }, fetcher)).rejects.toThrow();
    expect(setIcon).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the controller test to verify it fails**

Run: `npm test -- src/features/app-icon/appIconController.test.ts`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement the controller**

```ts
import { getCurrentWindow } from "@tauri-apps/api/window";

import { DYNAMIC_APP_ICON_ASSETS } from "./dynamicAppIconAssets";
import type { DynamicAppIconState } from "./dynamicAppIconState";

export type IconWindow = {
  setIcon(icon: Uint8Array): Promise<void>;
};

export async function applyDynamicAppIcon(
  state: DynamicAppIconState,
  windowRef: IconWindow = getCurrentWindow(),
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const response = await fetcher(DYNAMIC_APP_ICON_ASSETS[state]);
  if (!response.ok) throw new Error(`dynamic icon asset unavailable: ${state}`);
  await windowRef.setIcon(new Uint8Array(await response.arrayBuffer()));
}
```

- [ ] **Step 4: Enable Tauri PNG decoding and permission**

Change the Tauri dependency to:

```toml
tauri = { version = "2", features = ["image-png"] }
```

Add this permission to `src-tauri/capabilities/default.json`:

```json
"core:window:allow-set-icon"
```

- [ ] **Step 5: Run controller tests and Rust config validation**

Run: `npm test -- src/features/app-icon/appIconController.test.ts`

Expected: PASS.

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: PASS with the `image-png` feature enabled.

- [ ] **Step 6: Commit the native controller**

```bash
git add src/features/app-icon/appIconController.ts src/features/app-icon/appIconController.test.ts src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/capabilities/default.json
git commit -m "feat: apply runtime desktop app icons"
```

## Task 5: Refresh event and lifecycle hook

**Files:**

- Create: `src/services/tauri/dynamicAppIconEvents.ts`
- Create: `src/features/app-icon/useDynamicAppIcon.test.tsx`
- Create: `src/features/app-icon/useDynamicAppIcon.ts`

- [ ] **Step 1: Add the refresh event helper**

```ts
export const DYNAMIC_APP_ICON_REFRESH_EVENT = "work-shackle:dynamic-icon-refresh";

export function requestDynamicAppIconRefresh(): void {
  window.dispatchEvent(new Event(DYNAMIC_APP_ICON_REFRESH_EVENT));
}

export async function refreshDynamicAppIconAfter<T>(mutation: Promise<T>): Promise<T> {
  const result = await mutation;
  requestDynamicAppIconRefresh();
  return result;
}
```

- [ ] **Step 2: Write failing hook tests**

Use injected dependencies so tests never require a real Tauri window:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DYNAMIC_APP_ICON_REFRESH_EVENT } from "../../services/tauri/dynamicAppIconEvents";
import { useDynamicAppIcon, type DynamicAppIconRuntime } from "./useDynamicAppIcon";

afterEach(() => vi.useRealTimers());

function runtime(): DynamicAppIconRuntime {
  return {
    enabled: true,
    now: () => new Date(2026, 7, 31, 10, 0).getTime(),
    loadSnapshot: vi.fn(async (nowMs) => ({ nowMs })),
    applyIcon: vi.fn(async () => undefined),
    onFocus: vi.fn(async () => vi.fn()),
    onTaskChanged: vi.fn(async () => vi.fn()),
  };
}

describe("useDynamicAppIcon", () => {
  it("applies on mount, refreshes on request, and deduplicates the same state", async () => {
    const deps = runtime();
    renderHook(() => useDynamicAppIcon(null, deps));
    await waitFor(() => expect(deps.applyIcon).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new Event(DYNAMIC_APP_ICON_REFRESH_EVENT)));
    await waitFor(() => expect(deps.loadSnapshot).toHaveBeenCalledTimes(2));
    expect(deps.applyIcon).toHaveBeenCalledTimes(1);
  });

  it("retries a state after the previous native application failed", async () => {
    const deps = runtime();
    vi.mocked(deps.applyIcon).mockRejectedValueOnce(new Error("native failure"));
    renderHook(() => useDynamicAppIcon(null, deps));
    await waitFor(() => expect(deps.applyIcon).toHaveBeenCalledTimes(1));
    act(() => window.dispatchEvent(new Event(DYNAMIC_APP_ICON_REFRESH_EVENT)));
    await waitFor(() => expect(deps.applyIcon).toHaveBeenCalledTimes(2));
  });

  it("does nothing in web mode", () => {
    const deps = { ...runtime(), enabled: false };
    renderHook(() => useDynamicAppIcon(null, deps));
    expect(deps.loadSnapshot).not.toHaveBeenCalled();
  });

  it("refreshes after native focus or a reminder-window task change", async () => {
    const deps = runtime();
    let focusHandler: (() => void) | undefined;
    let taskHandler: (() => void) | undefined;
    deps.onFocus = vi.fn(async (handler) => {
      focusHandler = handler;
      return vi.fn();
    });
    deps.onTaskChanged = vi.fn(async (handler) => {
      taskHandler = handler;
      return vi.fn();
    });
    renderHook(() => useDynamicAppIcon(null, deps));
    await waitFor(() => expect(deps.loadSnapshot).toHaveBeenCalledTimes(1));
    act(() => focusHandler?.());
    await waitFor(() => expect(deps.loadSnapshot).toHaveBeenCalledTimes(2));
    act(() => taskHandler?.());
    await waitFor(() => expect(deps.loadSnapshot).toHaveBeenCalledTimes(3));
  });

  it("aligns recurring refresh to the next minute boundary", async () => {
    vi.useFakeTimers();
    const deps = runtime();
    deps.now = () => new Date(2026, 7, 31, 10, 0, 30).getTime();
    renderHook(() => useDynamicAppIcon(null, deps));
    await act(async () => { await Promise.resolve(); });
    expect(deps.loadSnapshot).toHaveBeenCalledTimes(1);
    await act(async () => {
      vi.advanceTimersByTime(30_000);
      await Promise.resolve();
    });
    expect(deps.loadSnapshot).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 3: Run hook tests to verify they fail**

Run: `npm test -- src/features/app-icon/useDynamicAppIcon.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 4: Implement the hook and default runtime**

```ts
import { isTauri } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef } from "react";

import { getActiveOvertime } from "../../services/tauri/overtime";
import { DYNAMIC_APP_ICON_REFRESH_EVENT } from "../../services/tauri/dynamicAppIconEvents";
import { REMINDER_TASK_CHANGED_EVENT } from "../../services/tauri/reminder";
import { getWorkSchedule } from "../../services/tauri/settings";
import { queryTasks } from "../../services/tauri/tasks";
import type { CurrentWorkStatus } from "../../services/tauri/workStatus";
import { applyDynamicAppIcon } from "./appIconController";
import { buildDynamicAppIconSnapshot } from "./dynamicAppIconSnapshot";
import { resolveDynamicAppIconState, type DynamicAppIconSnapshot, type DynamicAppIconState } from "./dynamicAppIconState";

export type DynamicAppIconRuntime = {
  enabled: boolean;
  now(): number;
  loadSnapshot(nowMs: number, currentStatus: CurrentWorkStatus | null): Promise<DynamicAppIconSnapshot>;
  applyIcon(state: DynamicAppIconState): Promise<void>;
  onFocus(refresh: () => void): Promise<() => void>;
  onTaskChanged(refresh: () => void): Promise<() => void>;
};

const defaultRuntime: DynamicAppIconRuntime = {
  enabled: isTauri(),
  now: Date.now,
  async loadSnapshot(nowMs, currentStatus) {
    const [tasks, schedule, activeOvertime] = await Promise.all([
      queryTasks(),
      getWorkSchedule(),
      getActiveOvertime(),
    ]);
    return buildDynamicAppIconSnapshot({ nowMs, tasks, schedule, activeOvertime, currentStatus });
  },
  applyIcon: applyDynamicAppIcon,
  async onFocus(refresh) {
    return getCurrentWindow().onFocusChanged(({ payload }) => {
      if (payload) refresh();
    });
  },
  async onTaskChanged(refresh) {
    return listen(REMINDER_TASK_CHANGED_EVENT, refresh);
  },
};

export function useDynamicAppIcon(
  currentStatus: CurrentWorkStatus | null,
  runtime: DynamicAppIconRuntime = defaultRuntime,
): void {
  const applied = useRef<DynamicAppIconState | null>(null);
  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (!runtime.enabled || refreshing.current) return;
    refreshing.current = true;
    try {
      const snapshot = await runtime.loadSnapshot(runtime.now(), currentStatus);
      const state = resolveDynamicAppIconState(snapshot);
      if (state !== applied.current) {
        await runtime.applyIcon(state);
        applied.current = state;
      }
    } catch (error) {
      if (import.meta.env.DEV) console.warn("dynamic app icon refresh failed", error);
    } finally {
      refreshing.current = false;
    }
  }, [currentStatus, runtime]);

  useEffect(() => {
    if (!runtime.enabled) return;
    void refresh();
    const onRefresh = () => void refresh();
    const onVisible = () => { if (document.visibilityState === "visible") onRefresh(); };
    window.addEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, onRefresh);
    document.addEventListener("visibilitychange", onVisible);
    let minuteInterval: number | undefined;
    const minuteTimeout = window.setTimeout(() => {
      onRefresh();
      minuteInterval = window.setInterval(onRefresh, 60_000);
    }, 60_000 - (runtime.now() % 60_000));
    let removeFocus: (() => void) | undefined;
    let removeTaskChanged: (() => void) | undefined;
    let disposed = false;
    void runtime.onFocus(onRefresh).then((remove) => {
      if (disposed) remove();
      else removeFocus = remove;
    });
    void runtime.onTaskChanged(onRefresh).then((remove) => {
      if (disposed) remove();
      else removeTaskChanged = remove;
    });
    return () => {
      disposed = true;
      window.removeEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, onRefresh);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearTimeout(minuteTimeout);
      if (minuteInterval != null) window.clearInterval(minuteInterval);
      removeFocus?.();
      removeTaskChanged?.();
    };
  }, [refresh, runtime]);
}
```

- [ ] **Step 5: Run hook, resolver, snapshot and controller tests**

Run: `npm test -- src/features/app-icon`

Expected: PASS.

- [ ] **Step 6: Commit the lifecycle hook**

```bash
git add src/services/tauri/dynamicAppIconEvents.ts src/features/app-icon/useDynamicAppIcon.ts src/features/app-icon/useDynamicAppIcon.test.tsx
git commit -m "feat: refresh dynamic icon across app lifecycle"
```

## Task 6: AppShell and service-mutation integration

**Files:**

- Modify: `src/shared/shell/AppShell.tsx`
- Modify: `src/services/tauri/tasks.ts`
- Modify: `src/services/tauri/settings.ts`
- Modify: `src/services/tauri/overtime.ts`
- Modify: `src/services/tauri/workStatus.ts`
- Create: `src/services/tauri/dynamicAppIconMutationEvents.test.ts`
- Test: `src/shared/shell/AppNavigation.test.tsx`

- [ ] **Step 1: Mount the hook once in the shell**

In `AppShellContent`, call the hook immediately after reading the work-status context:

```tsx
import { useDynamicAppIcon } from "../../features/app-icon/useDynamicAppIcon";

const { current, loading } = useWorkStatus();
useDynamicAppIcon(current);
```

- [ ] **Step 2: Wrap successful mutations with the shared notifier**

Import the shared wrapper from `dynamicAppIconEvents.ts` and wrap only mutation invokes:

```ts
import { refreshDynamicAppIconAfter } from "./dynamicAppIconEvents";

export async function createTask(input: CreateTaskInput): Promise<Task> {
  return refreshDynamicAppIconAfter(invoke<Task>("create_task", { input }));
}
```

In `tasks.ts`, use it for `createTask`, `updateTask`, `completeTask`, `cancelTask`, and `postponeTask`. Keep `getTaskDetail`, `getTaskById`, `queryTasks`, `queryHistoryTasks`, and `queryTodayTasks` read-only.

- [ ] **Step 3: Notify for schedule, overtime and work-status mutations**

Apply the same resolved-call pattern to:

- `saveDefaultWorkTimes`, `saveTodayWorkOverride`, and `clearTodayWorkOverride` in `settings.ts`;
- `startOvertime` and `endOvertime` in `overtime.ts`;
- `switchWorkStatus` in `workStatus.ts`.

Do not dispatch for getters, failed invokes, lunch settings, status-copy editing, or priority-only reads.

- [ ] **Step 4: Write the service-level mutation refresh test**

Mock Tauri `invoke`, listen for `DYNAMIC_APP_ICON_REFRESH_EVENT`, and verify representative task, schedule, overtime and work-status mutations:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { startOvertime } from "./overtime";
import { saveDefaultWorkTimes } from "./settings";
import { createTask, queryTasks } from "./tasks";
import { switchWorkStatus } from "./workStatus";
import { DYNAMIC_APP_ICON_REFRESH_EVENT } from "./dynamicAppIconEvents";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

describe("dynamic app icon mutation events", () => {
  beforeEach(() => vi.mocked(invoke).mockReset());

  it("dispatches once after each successful relevant mutation", async () => {
    vi.mocked(invoke).mockResolvedValue({});
    const changed = vi.fn();
    window.addEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, changed);
    await createTask({ title: "提交方案", plannedAtMs: 1, deadlineAtMs: 2 });
    await saveDefaultWorkTimes({ startTime: "09:00", endTime: "18:00" });
    await startOvertime();
    await switchWorkStatus("meeting");
    expect(changed).toHaveBeenCalledTimes(4);
    window.removeEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, changed);
  });

  it("does not dispatch for reads or rejected mutations", async () => {
    const changed = vi.fn();
    window.addEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, changed);
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await queryTasks();
    vi.mocked(invoke).mockRejectedValueOnce(new Error("failed"));
    await expect(startOvertime()).rejects.toThrow("failed");
    expect(changed).not.toHaveBeenCalled();
    window.removeEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, changed);
  });
});
```

- [ ] **Step 5: Run focused integration tests**

Run: `npm test -- src/services/tauri/dynamicAppIconMutationEvents.test.ts src/shared/shell/AppNavigation.test.tsx`

Expected: PASS.

- [ ] **Step 6: Commit integration**

```bash
git add src/shared/shell/AppShell.tsx src/services/tauri
git commit -m "feat: connect icon refresh to workday changes"
```

## Task 7: Final build, native smoke test and visual QA

**Files:**

- Verify: all files from Tasks 1–6
- Modify only if verification exposes a defect.

- [ ] **Step 1: Regenerate assets from a clean source-of-truth run**

Run: `npm run icons:generate`

Expected: command succeeds and `git status --short` shows no unexpected drift from committed generated assets.

- [ ] **Step 2: Run the complete frontend test suite**

Run: `npm test`

Expected: all Vitest tests PASS.

- [ ] **Step 3: Run the production frontend build**

Run: `npm run build`

Expected: TypeScript and Vite complete without errors; the six PNGs are included in `dist/assets`.

- [ ] **Step 4: Run Rust validation**

Run: `cargo test --manifest-path src-tauri/Cargo.toml`

Expected: all Rust tests PASS.

- [ ] **Step 5: Run the desktop app and exercise all state branches**

Run: `npm run tauri dev`

Use temporary test data and focused unit-test fixtures to verify:

- ordinary 09:59, 10:00, 13:59 and 14:00 boundaries;
- exactly 30 minutes before configured work end;
- exactly 30 minutes before DDL and an overdue task;
- active overtime;
- app blur/focus and background/foreground recovery;
- failed icon application leaves the previous/default icon without user-facing errors.

Expected: macOS Dock/window icon changes to the matching approved ghost face; task and reminder features remain usable.

- [ ] **Step 6: Inspect bundle outputs**

Run: `npm run tauri build`

Expected: generated macOS/Windows bundle artifacts use the `default` ghost icon. If cross-platform packaging is not available on the current host, record macOS verification and leave Windows runtime presentation as the documented platform-dependent follow-up.

- [ ] **Step 7: Confirm feature paths are fully committed**

```bash
git status --short
```

Expected: no uncommitted changes under `src/features/app-icon`, `src/assets/app-icons`, `src/services/tauri`, `src/shared/shell/AppShell.tsx`, `src-tauri/icons`, `src-tauri/Cargo.toml`, `src-tauri/capabilities/default.json`, `public/offwork-ghost.svg`, `scripts/generate-offwork-ghost-icons.mjs`, `index.html`, or `package.json`. Preserve unrelated pre-existing user changes and never stage them with a broad command.
