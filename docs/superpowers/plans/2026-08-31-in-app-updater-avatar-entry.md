# Work Shackle In-App Updater and Avatar Entry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a secure, user-initiated Tauri updater that checks GitHub Releases on launch and exposes download, progress, retry, and install states through the upper-left `WS` avatar.

**Architecture:** Isolate native updater/process calls in a frontend service, model asynchronous behavior in a testable React hook, and render the visual state in a dedicated avatar component integrated into `AppShell`. Configure signed updater artifacts and a tag-triggered GitHub Actions release pipeline for macOS Apple Silicon and Windows x64, while keeping updater permissions limited to the main window.

**Tech Stack:** React 19, TypeScript, Tauri 2 updater/process plugins, Rust, CSS, Vitest, Testing Library, GitHub Actions

**Execution constraint:** The user requested local implementation only. Do not create commits, push branches, create tags, upload secrets, or publish releases during this plan.

---

### Task 1: Install updater dependencies and create the signing key

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `.gitignore`
- Create locally but never stage: `src-tauri/.keys/work-shackle-updater.key`
- Create locally but never stage: `src-tauri/.keys/work-shackle-updater.key.pub`

- [ ] **Step 1: Install matching official JavaScript plugins**

Run:

```bash
npm install @tauri-apps/plugin-updater@^2 @tauri-apps/plugin-process@^2
```

Expected: both packages appear in `dependencies` and the lockfile resolves Tauri v2-compatible releases.

- [ ] **Step 2: Install matching Rust plugins**

Run:

```bash
cargo add --manifest-path src-tauri/Cargo.toml tauri-plugin-updater@2 tauri-plugin-process@2
```

Expected: `tauri-plugin-updater = "2"` and `tauri-plugin-process = "2"` appear in `src-tauri/Cargo.toml`, and Cargo updates its lockfile.

- [ ] **Step 3: Ignore the local signing-key directory**

Append this scoped entry to the root `.gitignore`:

```gitignore
# Local Tauri updater signing keys
src-tauri/.keys/
```

- [ ] **Step 4: Generate the updater key pair locally**

Run:

```bash
npm run tauri signer generate -- -w src-tauri/.keys/work-shackle-updater.key --ci
```

Expected: the private key and `.pub` public key are created under the ignored `.keys` directory. Record the public-key file content for Task 5. Never print or copy the private-key content into source, tests, plans, or conversation output.

- [ ] **Step 5: Verify secret isolation**

Run:

```bash
git check-ignore src-tauri/.keys/work-shackle-updater.key
git status --short
```

Expected: the key is ignored and does not appear in Git status. No commit is created.

### Task 2: Define the native updater service

**Files:**
- Create: `src/services/tauri/appUpdate.ts`
- Create: `src/services/tauri/appUpdate.test.ts`

- [ ] **Step 1: Write failing service tests**

Create tests that inject plugin bindings instead of contacting GitHub:

```ts
import { describe, expect, it, vi } from "vitest";

import { createAppUpdateClient } from "./appUpdate";

describe("app update client", () => {
  it("returns null outside the Tauri runtime", async () => {
    const client = createAppUpdateClient({ isTauri: () => false });
    await expect(client.check()).resolves.toBeNull();
  });

  it("maps update metadata and download progress", async () => {
    const events: Array<{ event: string; data?: Record<string, number> }> = [];
    const downloadAndInstall = vi.fn(async (listener) => {
      listener({ event: "Started", data: { contentLength: 100 } });
      listener({ event: "Progress", data: { chunkLength: 40 } });
      listener({ event: "Finished" });
    });
    const check = vi.fn(async () => ({
      version: "0.1.2",
      body: "Fixes",
      date: "2026-08-31T00:00:00Z",
      downloadAndInstall,
    }));
    const relaunch = vi.fn(async () => undefined);
    const client = createAppUpdateClient({
      isTauri: () => true,
      loadBindings: async () => ({ check, relaunch }),
    });

    const update = await client.check();
    const progress = vi.fn();
    await update?.downloadAndInstall(progress);
    await client.relaunch();

    expect(update).toMatchObject({ version: "0.1.2", body: "Fixes" });
    expect(progress).toHaveBeenNthCalledWith(1, {
      phase: "downloading",
      downloaded: 0,
      total: 100,
    });
    expect(progress).toHaveBeenNthCalledWith(2, {
      phase: "downloading",
      downloaded: 40,
      total: 100,
    });
    expect(progress).toHaveBeenLastCalledWith({ phase: "installing" });
    expect(relaunch).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run the service test and verify it fails**

Run: `npm test -- src/services/tauri/appUpdate.test.ts`

Expected: FAIL because `appUpdate.ts` does not exist.

- [ ] **Step 3: Implement the service boundary**

Create `appUpdate.ts` with these public types and behavior:

```ts
export type AppUpdateProgress =
  | { phase: "downloading"; downloaded: number; total: number | null }
  | { phase: "installing" };

export interface AppUpdateCandidate {
  version: string;
  body: string | null;
  date: string | null;
  downloadAndInstall(onProgress: (event: AppUpdateProgress) => void): Promise<void>;
}

export interface AppUpdateClient {
  check(): Promise<AppUpdateCandidate | null>;
  relaunch(): Promise<void>;
}

type NativeUpdate = {
  version: string;
  body?: string;
  date?: string;
  downloadAndInstall(listener: (event: NativeDownloadEvent) => void): Promise<void>;
};

type NativeDownloadEvent =
  | { event: "Started"; data: { contentLength?: number } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

type UpdateBindings = {
  check(): Promise<NativeUpdate | null>;
  relaunch(): Promise<void>;
};

type UpdateClientOptions = {
  isTauri?: () => boolean;
  loadBindings?: () => Promise<UpdateBindings>;
};

export function createAppUpdateClient(
  options: UpdateClientOptions = {},
): AppUpdateClient {
  const isTauri = options.isTauri ?? (() => "__TAURI_INTERNALS__" in window);
  const loadBindings = options.loadBindings ?? loadNativeBindings;

  return {
    async check() {
      if (!isTauri()) return null;
      const bindings = await loadBindings();
      const update = await bindings.check();
      if (!update) return null;

      return {
        version: update.version,
        body: update.body ?? null,
        date: update.date ?? null,
        async downloadAndInstall(onProgress) {
          let downloaded = 0;
          let total: number | null = null;
          await update.downloadAndInstall((event) => {
            if (event.event === "Started") {
              total = event.data.contentLength ?? null;
              onProgress({ phase: "downloading", downloaded, total });
            } else if (event.event === "Progress") {
              downloaded += event.data.chunkLength;
              onProgress({ phase: "downloading", downloaded, total });
            } else {
              onProgress({ phase: "installing" });
            }
          });
        },
      };
    },
    async relaunch() {
      const bindings = await loadBindings();
      await bindings.relaunch();
    },
  };
}

async function loadNativeBindings(): Promise<UpdateBindings> {
  const [{ check }, { relaunch }] = await Promise.all([
    import("@tauri-apps/plugin-updater"),
    import("@tauri-apps/plugin-process"),
  ]);
  return { check, relaunch };
}

export const appUpdateClient = createAppUpdateClient();
```

- [ ] **Step 4: Run the service tests**

Run: `npm test -- src/services/tauri/appUpdate.test.ts`

Expected: PASS for browser fallback, update mapping, progress, and relaunch.

### Task 3: Implement the update state machine

**Files:**
- Create: `src/shared/shell/useAppUpdate.ts`
- Create: `src/shared/shell/useAppUpdate.test.tsx`

- [ ] **Step 1: Write failing hook tests**

Cover silent mount checking, update availability, download progress, installation, relaunch, check failure, install retry, and duplicate-click protection. Use this client shape:

```tsx
const candidate = {
  version: "0.1.2",
  body: "Fixes",
  date: null,
  downloadAndInstall: vi.fn(async (onProgress) => {
    onProgress({ phase: "downloading", downloaded: 50, total: 100 });
    onProgress({ phase: "installing" });
  }),
};
const client: AppUpdateClient = {
  check: vi.fn(async () => candidate),
  relaunch: vi.fn(async () => undefined),
};
```

Assert the public hook result transitions through:

```ts
type AppUpdateState =
  | { status: "checking" }
  | { status: "current" }
  | { status: "available"; version: string; body: string | null }
  | { status: "downloading"; version: string; progress: number | null }
  | { status: "installing"; version: string }
  | { status: "failed"; message: string; retry: "check" | "install" };
```

The update test must call `activate()` after the `available` state, assert `progress === 50`, wait for `relaunch`, and assert a second activation while busy does not start another download.

- [ ] **Step 2: Run the hook tests and verify failure**

Run: `npm test -- src/shared/shell/useAppUpdate.test.tsx`

Expected: FAIL because the hook does not exist.

- [ ] **Step 3: Implement `useAppUpdate`**

The hook accepts `AppUpdateClient = appUpdateClient`, stores the current candidate in a ref, and exposes:

```ts
export function useAppUpdate(client: AppUpdateClient = appUpdateClient): {
  state: AppUpdateState;
  activate(): Promise<void>;
}
```

Implement the complete state machine:

```tsx
import { useCallback, useEffect, useRef, useState } from "react";

import {
  appUpdateClient,
  type AppUpdateCandidate,
  type AppUpdateClient,
} from "../../services/tauri/appUpdate";

export type AppUpdateState =
  | { status: "checking" }
  | { status: "current" }
  | { status: "available"; version: string; body: string | null }
  | { status: "downloading"; version: string; progress: number | null }
  | { status: "installing"; version: string }
  | { status: "failed"; message: string; retry: "check" | "install" };

export function useAppUpdate(client: AppUpdateClient = appUpdateClient) {
  const [state, setState] = useState<AppUpdateState>({ status: "checking" });
  const candidateRef = useRef<AppUpdateCandidate | null>(null);
  const activeRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    setState({ status: "checking" });
    try {
      const candidate = await client.check();
      candidateRef.current = candidate;
      setState(
        candidate
          ? { status: "available", version: candidate.version, body: candidate.body }
          : { status: "current" },
      );
    } catch {
      candidateRef.current = null;
      setState({
        status: "failed",
        message: "检查更新失败，点击重试",
        retry: "check",
      });
    } finally {
      activeRef.current = false;
    }
  }, [client]);

  const installCandidate = useCallback(async () => {
    const candidate = candidateRef.current;
    if (!candidate || activeRef.current) return;
    activeRef.current = true;
    setState({ status: "downloading", version: candidate.version, progress: 0 });
    try {
      await candidate.downloadAndInstall((event) => {
        if (event.phase === "installing") {
          setState({ status: "installing", version: candidate.version });
          return;
        }
        const progress = event.total
          ? Math.min(100, Math.round((event.downloaded / event.total) * 100))
          : null;
        setState({ status: "downloading", version: candidate.version, progress });
      });
      await client.relaunch();
    } catch {
      setState({
        status: "failed",
        message: "更新安装失败，点击重试",
        retry: "install",
      });
    } finally {
      activeRef.current = false;
    }
  }, [client]);

  useEffect(() => {
    void checkForUpdate();
  }, [checkForUpdate]);

  const activate = useCallback(async () => {
    if (activeRef.current) return;
    if (state.status === "available" || (state.status === "failed" && state.retry === "install")) {
      await installCandidate();
      return;
    }
    if (state.status === "current" || (state.status === "failed" && state.retry === "check")) {
      await checkForUpdate();
    }
  }, [checkForUpdate, installCandidate, state]);

  return { state, activate };
}
```

The candidate remains in `candidateRef` after an install failure, so retry does not require another release check.

- [ ] **Step 4: Run the hook tests**

Run: `npm test -- src/shared/shell/useAppUpdate.test.tsx`

Expected: PASS for all state transitions and retry behavior.

### Task 4: Build the accessible avatar update entry

**Files:**
- Create: `src/shared/shell/AppUpdateAvatar.tsx`
- Create: `src/shared/shell/AppUpdateAvatar.css`
- Create: `src/shared/shell/AppUpdateAvatar.test.tsx`

- [ ] **Step 1: Write failing component tests**

Render the component with each `AppUpdateState` and assert:

```tsx
expect(screen.getByRole("button", { name: "检查应用更新" })).toBeTruthy();
expect(
  screen.getByRole("button", {
    name: "发现新版本 0.1.2，点击下载更新",
  }),
).toBeTruthy();
expect(screen.getByText("↓")).toBeTruthy();
expect(screen.getByText("50%")).toBeTruthy();
expect(screen.getByText("更新安装失败，点击重试")).toBeTruthy();
```

Also click the available and failed buttons and assert `onActivate` is called once. Busy states must set `aria-busy="true"` and disable the button.

- [ ] **Step 2: Run the component tests and verify failure**

Run: `npm test -- src/shared/shell/AppUpdateAvatar.test.tsx`

Expected: FAIL because the component does not exist.

- [ ] **Step 3: Implement the component**

Use this structure without changing the existing `WS` resting visual:

```tsx
export function AppUpdateAvatar({ state, onActivate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const busy = ["checking", "downloading", "installing"].includes(state.status);
  const showBubble = expanded || state.status === "failed";

  const activate = () => {
    setExpanded(true);
    void onActivate();
  };

  return (
    <div className="ws-update-avatar" data-state={state.status}>
      <button
        type="button"
        className="ws-shell__logo ws-update-avatar__button"
        aria-label={labelForState(state)}
        aria-busy={busy}
        disabled={busy}
        onClick={activate}
      >
        <span aria-hidden="true">WS</span>
        {badgeForState(state)}
      </button>
      {showBubble ? (
        <p className="ws-update-avatar__bubble" role={state.status === "failed" ? "alert" : "status"}>
          {copyForState(state)}
        </p>
      ) : null}
    </div>
  );
}
```

Add these complete helpers below the component:

```tsx
function labelForState(state: AppUpdateState) {
  switch (state.status) {
    case "available":
      return `发现新版本 ${state.version}，点击下载更新`;
    case "downloading":
      return `正在下载版本 ${state.version}`;
    case "installing":
      return `正在安装版本 ${state.version}`;
    case "failed":
      return state.message;
    default:
      return "检查应用更新";
  }
}

function badgeForState(state: AppUpdateState) {
  if (state.status === "available") return <span className="ws-update-avatar__badge">↓</span>;
  if (state.status === "downloading") {
    return <span className="ws-update-avatar__badge">{state.progress === null ? "…" : `${state.progress}%`}</span>;
  }
  if (state.status === "installing") return <span className="ws-update-avatar__badge">↻</span>;
  if (state.status === "failed") return <span className="ws-update-avatar__badge">!</span>;
  return null;
}

function copyForState(state: AppUpdateState) {
  switch (state.status) {
    case "checking": return "正在检查更新";
    case "current": return "已是最新版本";
    case "available": return `发现新版本 ${state.version}`;
    case "downloading": return state.progress === null ? "正在下载更新" : `更新已下载 ${state.progress}%`;
    case "installing": return "正在安装，完成后将重新启动";
    case "failed": return state.message;
  }
}
```

- [ ] **Step 4: Implement visual styling**

Use this stylesheet:

```css
.ws-update-avatar {
  position: relative;
  width: 46px;
  height: 46px;
  flex: 0 0 46px;
}

.ws-update-avatar__button {
  position: relative;
  padding: 0;
  font: inherit;
}

.ws-update-avatar__button:disabled { cursor: wait; opacity: 1; }

.ws-update-avatar__badge {
  position: absolute;
  right: -7px;
  bottom: -6px;
  min-width: 20px;
  height: 20px;
  display: grid;
  place-items: center;
  padding: 0 3px;
  border: 2px solid var(--color-anchor);
  border-radius: 999px;
  color: white;
  background: var(--color-stage);
  font-family: var(--font-data);
  font-size: 0.58rem;
  font-weight: 1000;
  line-height: 1;
  transform: rotate(6deg);
}

.ws-update-avatar[data-state="downloading"] .ws-update-avatar__badge,
.ws-update-avatar[data-state="installing"] .ws-update-avatar__badge {
  background: var(--color-reaction);
}

.ws-update-avatar[data-state="failed"] .ws-update-avatar__badge {
  background: var(--color-danger);
}

.ws-update-avatar[data-state="installing"] .ws-update-avatar__badge {
  animation: ws-update-spin 900ms linear infinite;
}

.ws-update-avatar__bubble {
  position: absolute;
  z-index: 50;
  top: calc(100% + 10px);
  left: 0;
  width: max-content;
  max-width: min(260px, calc(100vw - 48px));
  margin: 0;
  padding: 7px 9px;
  border: 2px solid var(--color-anchor);
  border-radius: 3px;
  color: var(--color-ink);
  background: var(--color-paper-raised);
  box-shadow: 3px 3px 0 var(--color-anchor);
  font-size: var(--font-size-caption);
  font-weight: 900;
}

@keyframes ws-update-spin { to { transform: rotate(366deg); } }

@media (max-width: 460px) {
  .ws-update-avatar { width: 40px; height: 40px; flex-basis: 40px; }
  .ws-update-avatar__badge { right: -6px; bottom: -5px; min-width: 18px; height: 18px; }
}

@media (prefers-reduced-motion: reduce) {
  .ws-update-avatar[data-state="installing"] .ws-update-avatar__badge { animation: none; }
}
```

- [ ] **Step 5: Run component tests**

Run: `npm test -- src/shared/shell/AppUpdateAvatar.test.tsx`

Expected: PASS for accessible labels, badge content, busy state, retry copy, and activation.

### Task 5: Integrate the updater and configure Tauri security

**Files:**
- Modify: `src/shared/shell/AppShell.tsx`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/capabilities/default.json`
- Create: `src-tauri/capabilities/reminder.json`
- Modify: `src-tauri/tauri.conf.json`
- Create: `src/shared/shell/appUpdateIntegration.test.ts`

- [ ] **Step 1: Write a failing integration/config contract test**

Read the source and JSON files and assert:

```ts
expect(shellSource).toContain("useAppUpdate()");
expect(shellSource).toContain("<AppUpdateAvatar");
expect(shellSource).not.toContain('<span className="ws-shell__logo"');
expect(libSource).toContain("tauri_plugin_updater::Builder::new().build()");
expect(libSource).toContain("tauri_plugin_process::init()");
expect(mainCapability.windows).toEqual(["main"]);
expect(mainCapability.permissions).toContain("updater:default");
expect(mainCapability.permissions).toContain("process:allow-restart");
expect(reminderCapability.windows).toEqual(["ddl-reminder"]);
expect(reminderCapability.permissions).not.toContain("updater:default");
expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(true);
expect(tauriConfig.plugins.updater.endpoints).toContain(
  "https://github.com/zaragui-hue/work-shackle-web/releases/latest/download/latest.json",
);
expect(tauriConfig.plugins.updater.pubkey.length).toBeGreaterThan(40);
```

- [ ] **Step 2: Run the contract test and verify failure**

Run: `npm test -- src/shared/shell/appUpdateIntegration.test.ts`

Expected: FAIL because the UI integration, plugins, permissions, and updater config do not exist.

- [ ] **Step 3: Integrate the avatar in `AppShell`**

Import `AppUpdateAvatar` and `useAppUpdate`, then add:

```tsx
const appUpdate = useAppUpdate();
```

Replace only the existing logo span:

```tsx
<AppUpdateAvatar
  state={appUpdate.state}
  onActivate={appUpdate.activate}
/>
```

Do not alter navigation, fullscreen, status, reminder bridge, or page selection logic.

- [ ] **Step 4: Initialize native plugins**

Add these builder calls in `src-tauri/src/lib.rs` before `.manage(AppState::new())`:

```rust
.plugin(tauri_plugin_process::init())
.plugin(tauri_plugin_updater::Builder::new().build())
```

- [ ] **Step 5: Restrict capabilities by window**

Change `default.json` to target only `main` and add:

```json
"updater:default",
"process:allow-restart"
```

Create `reminder.json`:

```json
{
  "$schema": "../gen/schemas/desktop-schema.json",
  "identifier": "reminder-window",
  "description": "Capability for the deadline reminder window",
  "windows": ["ddl-reminder"],
  "permissions": [
    "core:default",
    "notification:default",
    "dialog:default"
  ]
}
```

- [ ] **Step 6: Configure updater artifacts and endpoint**

In `tauri.conf.json`, add `"createUpdaterArtifacts": true` under `bundle`. Read the public-key file created in Task 1, then insert its exact one-line content as `plugins.updater.pubkey` alongside this endpoint and Windows mode:

```json
"endpoints": [
  "https://github.com/zaragui-hue/work-shackle-web/releases/latest/download/latest.json"
],
"windows": {
  "installMode": "passive"
}
```

Use the generated public value literally; do not use a file path and do not embed the private key.

- [ ] **Step 7: Run integration and related shell tests**

Run:

```bash
npm test -- src/shared/shell/appUpdateIntegration.test.ts src/shared/shell/AppUpdateAvatar.test.tsx src/shared/shell/AppNavigation.test.tsx src/shared/shell/fullscreenShellStructure.test.ts
```

Expected: all tests PASS and the existing shell behavior remains intact.

### Task 6: Synchronize bootstrap version 0.1.1

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/tauri.conf.json`
- Create: `src/shared/shell/appVersionContract.test.ts`

- [ ] **Step 1: Write the failing version contract test**

Parse `package.json` and `tauri.conf.json`, read `Cargo.toml`, and assert:

```ts
expect(packageJson.version).toBe("0.1.1");
expect(tauriConfig.version).toBe("0.1.1");
expect(cargoToml).toMatch(/\[package\][\s\S]*?version\s*=\s*"0\.1\.1"/);
```

- [ ] **Step 2: Run the contract test and verify failure**

Run: `npm test -- src/shared/shell/appVersionContract.test.ts`

Expected: FAIL because all manifests still declare `0.1.0`.

- [ ] **Step 3: Update all version sources**

Run:

```bash
npm version 0.1.1 --no-git-tag-version
cargo update --manifest-path src-tauri/Cargo.toml -p work-shackle
```

Then set `src-tauri/tauri.conf.json` to `"version": "0.1.1"` and `src-tauri/Cargo.toml` package version to `0.1.1` if Cargo did not update it automatically.

- [ ] **Step 4: Run the version contract test**

Run: `npm test -- src/shared/shell/appVersionContract.test.ts`

Expected: PASS with `0.1.1` in npm, Cargo, and Tauri manifests.

### Task 7: Add the tag-triggered release workflow

**Files:**
- Create: `.github/workflows/release.yml`
- Create: `src/shared/shell/appReleaseWorkflow.test.ts`

- [ ] **Step 1: Write a failing workflow contract test**

Read the workflow as text and assert it contains:

```ts
expect(workflow).toMatch(/tags:\s*\n\s*- ["']v\*/);
expect(workflow).toContain("macos-14");
expect(workflow).toContain("aarch64-apple-darwin");
expect(workflow).toContain("windows-latest");
expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY");
expect(workflow).toContain("TAURI_SIGNING_PRIVATE_KEY_PASSWORD");
expect(workflow).toContain("tauri-apps/tauri-action@v0.6.2");
expect(workflow).toContain("tagName: v__VERSION__");
expect(workflow).toContain("releaseDraft: false");
```

- [ ] **Step 2: Run the workflow test and verify failure**

Run: `npm test -- src/shared/shell/appReleaseWorkflow.test.ts`

Expected: FAIL because the release workflow does not exist.

- [ ] **Step 3: Create `.github/workflows/release.yml`**

Use this tag-only matrix:

```yaml
name: Release desktop app

on:
  push:
    tags:
      - "v*"

permissions:
  contents: write

jobs:
  release:
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: macos-14
            target: aarch64-apple-darwin
            args: --target aarch64-apple-darwin
          - platform: windows-latest
            target: x86_64-pc-windows-msvc
            args: --target x86_64-pc-windows-msvc
    runs-on: ${{ matrix.platform }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.target }}
      - name: Install frontend dependencies
        run: npm ci
      - name: Build and publish signed release
        uses: tauri-apps/tauri-action@v0.6.2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
        with:
          tagName: v__VERSION__
          releaseName: Work Shackle v__VERSION__
          releaseBody: Download the installer for your platform. Existing 0.1.1+ installations can update from inside the app.
          releaseDraft: false
          prerelease: false
          generateReleaseNotes: true
          args: ${{ matrix.args }}
```

- [ ] **Step 4: Run the workflow contract test**

Run: `npm test -- src/shared/shell/appReleaseWorkflow.test.ts`

Expected: PASS for tag gating, targets, signing secrets, and release metadata.

### Task 8: Run complete verification and visual QA

**Files:**
- Verify all files from Tasks 1–7

- [ ] **Step 1: Run focused updater tests**

Run:

```bash
npm test -- src/services/tauri/appUpdate.test.ts src/shared/shell/useAppUpdate.test.tsx src/shared/shell/AppUpdateAvatar.test.tsx src/shared/shell/appUpdateIntegration.test.ts src/shared/shell/appVersionContract.test.ts src/shared/shell/appReleaseWorkflow.test.ts
```

Expected: all updater tests PASS.

- [ ] **Step 2: Run the complete frontend suite and build**

Run:

```bash
npm test
npm run build
```

Expected: all tests PASS and TypeScript/Vite build succeeds.

- [ ] **Step 3: Run Rust and Tauri configuration checks**

Run:

```bash
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build -- --debug --no-bundle
```

Expected: Rust compiles, Tauri accepts the updater configuration and permissions, and the debug desktop binary builds without publishing or installing anything.

- [ ] **Step 4: Visually verify avatar states**

Use dependency injection or a development-only preview state to render `current`, `available`, `downloading`, `installing`, and `failed` at 1280px and 390px. Confirm:

- the resting `WS` circle remains unchanged;
- the badge stays anchored without moving the brand copy;
- progress and retry copy are readable;
- focus indication and reduced motion work;
- no dark outer frame returns.

- [ ] **Step 5: Inspect final local scope without committing**

Run:

```bash
git diff --check
git status --short
git diff -- package.json package-lock.json src-tauri/Cargo.toml src-tauri/tauri.conf.json src-tauri/src/lib.rs src-tauri/capabilities src/services/tauri/appUpdate.ts src/shared/shell .github/workflows/release.yml
```

Expected: no whitespace errors; updater changes remain local and unstaged; pre-existing unrelated working-tree changes remain present and untouched.

### Task 9: Record the deferred release operations

**Files:**
- No source changes

- [ ] **Step 1: Report the local signing secret requirements**

Report that GitHub needs `TAURI_SIGNING_PRIVATE_KEY` and, if used, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`. Do not reveal secret values.

- [ ] **Step 2: Report the staged-release test still required**

Before any public tag, build `0.1.1`, install it on macOS Apple Silicon and Windows x64, publish a private/prerelease `0.1.2` test, and verify discovery, signed download, installation, and relaunch on both platforms.

- [ ] **Step 3: Stop before Git operations**

Do not commit, push, tag, create GitHub secrets, or publish a release. Ask the user for explicit authorization in a later turn.
