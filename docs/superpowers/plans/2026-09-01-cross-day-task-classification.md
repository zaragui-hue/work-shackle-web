# Cross-Day Task Classification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep active tasks in the desktop Today list from their planned date through their DDL date, move them to Yesterday's Unfinished list on the next local calendar day, and refresh classification automatically when the calendar day changes.

**Architecture:** Rust remains the authoritative desktop task classifier. A focused React hook owns calendar-boundary and foreground refresh signals, while `TodayPage` continues to own the existing query and state update function. No database migration or task timestamp mutation is needed.

**Tech Stack:** Rust, Chrono, Rusqlite, React 19, TypeScript, Vitest, Testing Library, Tauri 2, cargo-xwin, NSIS.

---

### Task 1: Lock the cross-day classification contract with Rust tests

**Files:**
- Modify: `src-tauri/src/services/task.rs:1687-2040`

- [ ] **Step 1: Add failing classification tests**

Extend the `today_tasks` test module with local dates that cover an active multi-day range and add these tests:

```rust
#[test]
fn task_remains_formal_between_planned_day_and_deadline_day() {
    let db = open_test_database();
    insert_task(
        &db.connection,
        "active-range",
        local_ms("2026-09-01", "09:00"),
        Some(local_ms("2026-09-30", "18:00")),
    );

    let result = query_at(&db.connection, local_ms("2026-09-15", "12:00"));
    assert_eq!(ids(&result.formal_tasks), vec!["active-range"]);
    assert!(result.overdue_tasks.is_empty());
}

#[test]
fn task_remains_formal_for_entire_deadline_calendar_day() {
    let db = open_test_database();
    insert_task(
        &db.connection,
        "deadline-today",
        local_ms("2026-09-01", "09:00"),
        Some(local_ms("2026-09-30", "10:00")),
    );

    let result = query_at(&db.connection, local_ms("2026-09-30", "23:00"));
    assert_eq!(ids(&result.formal_tasks), vec!["deadline-today"]);
    assert!(result.overdue_tasks.is_empty());
    assert!(result.upcoming_deadline_tasks.is_empty());
}

#[test]
fn task_moves_to_overdue_on_day_after_deadline() {
    let db = open_test_database();
    insert_task(
        &db.connection,
        "expired-range",
        local_ms("2026-09-01", "09:00"),
        Some(local_ms("2026-09-30", "18:00")),
    );

    let result = query_at(&db.connection, local_ms("2026-10-01", "00:01"));
    assert!(result.formal_tasks.is_empty());
    assert_eq!(ids(&result.overdue_tasks), vec!["expired-range"]);
}

#[test]
fn cross_day_task_without_deadline_remains_formal() {
    let db = open_test_database();
    insert_task(
        &db.connection,
        "undated-carryover",
        local_ms("2026-09-01", "09:00"),
        None,
    );

    let result = query_at(&db.connection, local_ms("2026-10-01", "12:00"));
    assert_eq!(ids(&result.formal_tasks), vec!["undated-carryover"]);
    assert!(result.overdue_tasks.is_empty());
}

#[test]
fn future_planned_task_does_not_appear_early() {
    let db = open_test_database();
    insert_task(
        &db.connection,
        "future-task",
        local_ms("2026-09-20", "09:00"),
        Some(local_ms("2026-09-30", "18:00")),
    );

    let result = query_at(&db.connection, local_ms("2026-09-15", "12:00"));
    assert!(result.formal_tasks.is_empty());
    assert!(result.overdue_tasks.is_empty());
}
```

Change the existing inconsistent-data test `planned_today_with_yesterday_deadline_in_formal_and_overdue` to `historical_deadline_is_only_overdue`, and assert that the task is absent from `formal_tasks` and present once in `overdue_tasks`.

- [ ] **Step 2: Run the focused tests and confirm the new contract fails**

Run:

```bash
cargo test services::task::tests::today_tasks --lib
```

Expected: the active-range and undated-carryover tests fail because the current classifier only accepts dates equal to today; the duplicate inconsistent-data assertion also fails after changing its expectation.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src-tauri/src/services/task.rs
git commit -m "test: define cross-day task classification"
```

### Task 2: Implement interval-based desktop task classification

**Files:**
- Modify: `src-tauri/src/services/task.rs:461-507`

- [ ] **Step 1: Replace equality-only classification with interval classification**

Inside `classify_today_tasks`, calculate the planned calendar date once and make overdue/formal mutually exclusive:

```rust
let planned_date = calendar_day::local_date_from_ms(dto.planned_at_ms);
let has_reached_planned_date = planned_date <= today;
let is_historical_overdue = dto.deadline_at_ms.is_some_and(|deadline_at_ms| {
    calendar_day::is_local_calendar_day_before(deadline_at_ms, today)
});

if is_historical_overdue {
    overdue_tasks.push(dto);
    continue;
}

if has_reached_planned_date {
    if dto
        .deadline_at_ms
        .is_some_and(|deadline_at_ms| deadline_at_ms > as_of_ms)
    {
        upcoming_deadline_tasks.push(dto.clone());
    }
    formal_tasks.push(dto);
}
```

Remove the now-unused `planned_today` and `deadline_today` variables. Keep completed/cancelled handling and all existing sort blocks unchanged.

- [ ] **Step 2: Run the Rust classification tests**

Run:

```bash
cargo test services::task::tests::today_tasks --lib
```

Expected: all Today classification tests pass, including the September 1–30 interval, no-DDL carryover, future-plan exclusion, and no-duplicate assertions.

- [ ] **Step 3: Run the full Rust library suite**

Run:

```bash
cargo test --lib
```

Expected: all Rust library tests pass with no new failures.

- [ ] **Step 4: Commit the classifier**

```bash
git add src-tauri/src/services/task.rs
git commit -m "fix: classify active tasks across calendar days"
```

### Task 3: Add a tested calendar-day refresh hook

**Files:**
- Create: `src/features/today/useCalendarDayRefresh.ts`
- Create: `src/features/today/useCalendarDayRefresh.test.ts`

- [ ] **Step 1: Write failing hook tests**

Create `useCalendarDayRefresh.test.ts` using fake timers and `renderHook`. Cover the local midnight boundary, focus, visibility, and cleanup:

```ts
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useCalendarDayRefresh } from "./useCalendarDayRefresh";

describe("useCalendarDayRefresh", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 23, 59, 59));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("refreshes at each local midnight", () => {
    const refresh = vi.fn();
    renderHook(() => useCalendarDayRefresh(refresh));

    act(() => vi.advanceTimersByTime(1_000));
    expect(refresh).toHaveBeenCalledTimes(1);

    act(() => vi.advanceTimersByTime(24 * 60 * 60 * 1_000));
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it("refreshes when the window regains focus", () => {
    const refresh = vi.fn();
    renderHook(() => useCalendarDayRefresh(refresh));

    act(() => window.dispatchEvent(new Event("focus")));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("refreshes when the document becomes visible", () => {
    const refresh = vi.fn();
    renderHook(() => useCalendarDayRefresh(refresh));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });

    act(() => document.dispatchEvent(new Event("visibilitychange")));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("cleans up timers and listeners on unmount", () => {
    const refresh = vi.fn();
    const { unmount } = renderHook(() => useCalendarDayRefresh(refresh));
    unmount();

    act(() => {
      vi.advanceTimersByTime(1_000);
      window.dispatchEvent(new Event("focus"));
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
npm test -- --run src/features/today/useCalendarDayRefresh.test.ts
```

Expected: FAIL because `useCalendarDayRefresh.ts` does not exist.

- [ ] **Step 3: Implement the focused hook**

Create `useCalendarDayRefresh.ts`:

```ts
import { useEffect } from "react";

const nextLocalMidnightDelay = () => {
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 0, 0);
  return nextMidnight.getTime() - now.getTime();
};

export function useCalendarDayRefresh(
  refresh: () => void | Promise<void>,
) {
  useEffect(() => {
    let timerId: number | undefined;

    const scheduleNextMidnight = () => {
      timerId = window.setTimeout(() => {
        void refresh();
        scheduleNextMidnight();
      }, nextLocalMidnightDelay());
    };
    const handleFocus = () => void refresh();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    scheduleNextMidnight();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (timerId !== undefined) window.clearTimeout(timerId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refresh]);
}
```

- [ ] **Step 4: Run the hook tests**

Run:

```bash
npm test -- --run src/features/today/useCalendarDayRefresh.test.ts
```

Expected: all four hook tests pass.

- [ ] **Step 5: Commit the hook**

```bash
git add src/features/today/useCalendarDayRefresh.ts src/features/today/useCalendarDayRefresh.test.ts
git commit -m "feat: refresh today tasks at calendar boundaries"
```

### Task 4: Integrate date refresh into the desktop Today page

**Files:**
- Modify: `src/pages/TodayPage.tsx:1-121`

- [ ] **Step 1: Wire the hook to the existing task query**

Add the import:

```ts
import { useCalendarDayRefresh } from "../features/today/useCalendarDayRefresh";
```

Call it directly after the existing automatic-start hook so both mechanisms reuse `loadTodayTasks`:

```ts
useTaskAutoStart(todayTasks.formalTasks, loadTodayTasks);
useCalendarDayRefresh(loadTodayTasks);
```

- [ ] **Step 2: Run frontend tests and production build**

Run:

```bash
npm test
npm run build
```

Expected: all frontend tests pass, TypeScript succeeds, and Vite produces the production bundle.

- [ ] **Step 3: Commit the page integration**

```bash
git add src/pages/TodayPage.tsx
git commit -m "fix: refresh today tasks after date changes"
```

### Task 5: Bump the fixed desktop release to 0.1.2

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json`

- [ ] **Step 1: Update every application version field**

Change the root package and lockfile application version from `0.1.1` to `0.1.2`, change the `work-shackle` package version in `src-tauri/Cargo.toml` and its own entry in `src-tauri/Cargo.lock` to `0.1.2`, and change the Tauri configuration version to `0.1.2`. Do not change dependency versions.

- [ ] **Step 2: Verify version consistency**

Run:

```bash
rg -n '"version": "0\.1\.2"|^version = "0\.1\.2"' package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
```

Expected: the application version is `0.1.2` in all five files, including both root entries in `package-lock.json`, with no dependency version edits.

- [ ] **Step 3: Commit the release version**

```bash
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/tauri.conf.json
git commit -m "chore: bump desktop release to 0.1.2"
```

### Task 6: Run release verification and package Windows x64

**Files:**
- Create: `release/installers/精神状态事务所_0.1.2_Windows_x64_Setup.exe`
- Create: `release/installers/SHA256SUMS-0.1.2.txt`

- [ ] **Step 1: Run the complete regression checks**

Run:

```bash
npm test
npm run build
cargo test --lib --manifest-path src-tauri/Cargo.toml
```

Expected: all frontend tests, the production frontend build, and all Rust library tests pass.

- [ ] **Step 2: Confirm the local cross-compilation tools exist**

Run:

```bash
test -x /private/tmp/work-shackle-llvm15/clang+llvm-15.0.7-arm64-apple-darwin22.0/bin/llvm-rc
test -x /private/tmp/work-shackle-nsis-host/bin/makensis
rustup target list --installed | rg '^x86_64-pc-windows-msvc$'
cargo xwin --version
```

Expected: both local tools are executable, the Windows MSVC target is installed, and cargo-xwin prints its version.

- [ ] **Step 3: Build the Windows x64 NSIS installer and updater signature**

Ensure `/private/tmp/work-shackle-nsis-host/bin/makensis.exe` points to the native `makensis`, then run:

```bash
ln -sf /private/tmp/work-shackle-nsis-host/bin/makensis /private/tmp/work-shackle-nsis-host/bin/makensis.exe
PATH="/private/tmp/work-shackle-llvm15/clang+llvm-15.0.7-arm64-apple-darwin22.0/bin:/private/tmp/work-shackle-nsis-host/bin:$PATH" TAURI_SIGNING_PRIVATE_KEY="$(<src-tauri/.keys/work-shackle-updater.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD='' npm run tauri build -- --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis --ci
```

Expected outputs:

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/精神状态事务所_0.1.2_x64-setup.exe
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/精神状态事务所_0.1.2_x64-setup.exe.sig
```

The updater key contents must never be printed or copied into logs.

- [ ] **Step 4: Validate and copy the installer**

Run:

```bash
file 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/精神状态事务所_0.1.2_x64-setup.exe'
cp 'src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/精神状态事务所_0.1.2_x64-setup.exe' 'release/installers/精神状态事务所_0.1.2_Windows_x64_Setup.exe'
shasum -a 256 'release/installers/精神状态事务所_0.1.2_Windows_x64_Setup.exe'
```

Expected: `file` identifies a Nullsoft self-extracting Windows installer. Record the exact SHA-256 output, then use `apply_patch` to create `release/installers/SHA256SUMS-0.1.2.txt` with that exact hash and filename.

- [ ] **Step 5: Recheck the published artifact**

Run:

```bash
shasum -a 256 -c SHA256SUMS-0.1.2.txt
ls -lh '精神状态事务所_0.1.2_Windows_x64_Setup.exe' SHA256SUMS-0.1.2.txt
```

Run from `release/installers`. Expected: the installer reports `OK`, and both release files are present.

- [ ] **Step 6: Commit only the new release metadata and installer if repository policy tracks binaries**

First inspect `git status --short`. If `release/installers` is tracked by this project, stage only the two 0.1.2 files and commit:

```bash
git add 'release/installers/精神状态事务所_0.1.2_Windows_x64_Setup.exe' release/installers/SHA256SUMS-0.1.2.txt
git commit -m "build: package Windows 0.1.2 installer"
```

Do not stage unrelated working-tree changes.
