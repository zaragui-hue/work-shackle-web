# Work Shackle In-App Updater and Avatar Entry Design

## Goal

Add a secure in-app update path for Work Shackle. The app checks GitHub Releases for newer signed versions and exposes the update action through the circular `WS` avatar in the upper-left brand header, without changing existing business behavior or the surrounding visual language.

## Migration Constraint

The distributed `0.1.0` installers do not contain updater code, so those installations cannot discover or install an update automatically. Version `0.1.1` is the one-time bootstrap release: existing users manually install it once. Every version from `0.1.1` onward can use the in-app updater.

The initial supported update targets match the existing installer set:

- macOS Apple Silicon (`darwin-aarch64`)
- Windows x64 (`windows-x86_64`)

## Update Source and Security

Use the official Tauri v2 updater plugin with a static GitHub Releases endpoint:

`https://github.com/zaragui-hue/work-shackle-web/releases/latest/download/latest.json`

Updater artifacts must be signed with a dedicated Tauri updater key. The public key is embedded in `tauri.conf.json`; the private key and optional password are never committed and are provided to the release build through GitHub Actions secrets. Signature verification remains mandatory.

The Tauri bundle generates updater artifacts for macOS and Windows. A GitHub Actions release workflow builds both targets, uploads the normal installers, updater bundles, signatures, and `latest.json`, and only runs for an explicit version tag. A normal push to `main` must not publish an update.

## Application Architecture

### Update service

Create a small frontend adapter around the Tauri updater and process plugins. It owns only platform calls:

- check the configured endpoint for an update;
- return update metadata;
- download and install while reporting progress;
- relaunch after a successful installation;
- return a safe unavailable result in browser preview or when the native APIs cannot be resolved.

Keeping plugin access behind the adapter lets the update state be tested without invoking native installers.

### Update state hook

A shared hook owns the update state machine:

- `idle`: native availability has not yet been checked;
- `checking`: checking GitHub Releases;
- `current`: installed version is current;
- `available`: a newer version is ready to download;
- `downloading`: bytes are being downloaded;
- `installing`: download completed and installation is in progress;
- `failed`: check, download, or installation failed and can be retried.

On main-shell mount, the hook performs one silent check. It does not poll and does not download automatically. Repeated clicks while checking, downloading, or installing are ignored. Errors are converted to concise user-facing copy and must not throw into the rest of the app.

### Avatar entry

Turn the existing circular `WS` logo into an accessible button without changing its resting appearance.

- `idle`, `checking`, and `current`: preserve the current `WS` circle. Checking may use a subtle busy indicator that does not change layout.
- `available`: add a high-contrast download badge at the lower-right edge and an accessible label such as `发现新版本 0.1.2，点击下载更新`.
- `downloading`: replace the badge glyph with compact progress, rounded to a whole percentage when total size is known.
- `installing`: show a small rotating/installing indicator and disable repeat actions.
- `failed`: show a compact warning badge; clicking retries the failed operation.

A small anchored status bubble appears beside the avatar only after user interaction or on failure. It reports version, progress, installation state, or retry text. Routine “already current” checks stay silent.

Keyboard activation, focus visibility, `aria-label`, disabled/busy state, and reduced-motion behavior are required. Header dimensions and the surrounding brand copy do not move when the badge appears.

## Update Flow

1. App shell mounts and silently calls the update check.
2. If no newer version exists, the avatar remains visually unchanged.
3. If a newer signed release exists, the avatar receives the download badge.
4. The user clicks the avatar.
5. The app downloads the updater artifact and displays progress.
6. Tauri verifies the artifact signature and installs it.
7. The app relaunches into the new version.
8. If any step fails, the app remains usable and the avatar offers retry.

The update is user-initiated. The app must not silently install or relaunch.

## Native Configuration

The implementation adds:

- `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process` JavaScript packages;
- matching Rust updater and process plugins;
- desktop plugin initialization in the Tauri builder;
- `updater:default` and process relaunch permissions for the main window;
- `bundle.createUpdaterArtifacts: true`;
- the updater public key and GitHub `latest.json` endpoint;
- version `0.1.1` consistently in the frontend package, Rust crate, and Tauri config;
- a tag-triggered GitHub Actions release workflow for macOS Apple Silicon and Windows x64.

The reminder window does not expose updater controls. Only the main window receives the necessary frontend capability.

## Release Workflow

Publishing an update is an explicit operational action:

1. finish and test a version;
2. update the version consistently;
3. commit and push when authorized;
4. create and push the matching `vX.Y.Z` tag;
5. GitHub Actions builds signed updater artifacts and creates the GitHub Release;
6. installed apps find that release through `latest.json`.

The workflow requires these repository secrets:

- `TAURI_SIGNING_PRIVATE_KEY`
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` when the key is password-protected

macOS code signing and notarization are separate from updater signature verification. The initial implementation can preserve the current ad-hoc signing behavior, but users may still see Gatekeeper warnings until Apple signing and notarization are configured.

## Error Handling

- Offline, endpoint, or malformed-release errors become `failed` with a retry action.
- Invalid signatures or installer failures never fall back to an unsigned download.
- Missing native APIs in browser preview resolve to `current`/unavailable without visible error noise.
- A failed update does not block navigation, tasks, reminders, settings, or shutdown behavior.
- Relaunch is attempted only after the updater reports successful installation.

## Verification

Automated verification covers:

- update-service browser fallback and native adapter behavior;
- hook transitions for current, available, download progress, install, retry, and duplicate-click protection;
- avatar accessibility and state-specific badge copy;
- main-shell integration without reminder-window exposure;
- updater/process dependencies, permissions, Tauri configuration, release workflow targets, and synchronized `0.1.1` versions;
- the complete frontend test suite, TypeScript/Vite build, and Rust checks.

Visual verification covers normal desktop and narrow widths, ensuring the avatar badge does not shift the brand header or remove existing visual styling.

Live end-to-end update installation cannot be proven until a signed release and GitHub secrets exist. Before publication, perform a staged release test where an older bootstrap build discovers, downloads, installs, and relaunches into a newer test version on both supported platforms.

## Out of Scope

- Silent installation without a click
- Background polling during the session
- Delta updates
- Linux, Intel macOS, or additional Windows architectures
- Apple Developer signing and notarization setup
- Automatically committing, pushing, tagging, or releasing without explicit authorization
