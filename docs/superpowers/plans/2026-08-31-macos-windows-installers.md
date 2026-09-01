# macOS and Windows Installers Implementation Plan

> **For Codex:** Execute this plan in the current workspace and preserve unrelated working-tree changes.

**Goal:** Produce installable macOS and Windows packages for the current Work Shackle application.

**Architecture:** Use the existing Tauri v2 bundle configuration and icons. Build and verify the Apple Silicon macOS app/DMG locally, then use Tauri's documented `cargo-xwin` path to cross-compile the Windows x64 NSIS installer from macOS. Collect final artifacts in one release directory without committing generated binaries.

**Tech Stack:** React, Vite, Tauri 2, Rust, NSIS, cargo-xwin

---

### Task 1: Validate packaging inputs

- [x] Confirm Tauri product name, version, identifier, and bundle targets.
- [x] Confirm macOS and Windows icon resources exist.
- [x] Confirm Node, npm, Rust, Cargo, and Tauri CLI versions.

### Task 2: Build and verify macOS artifacts

- [x] Run the production Tauri build for `.app` and `.dmg` with ad-hoc signing.
- [x] Verify the application signature and DMG integrity.
- [x] Copy the verified artifacts into `release/installers/`.

### Task 3: Prepare Windows cross-compilation

- [x] Install the official Tauri prerequisites for an x64 Windows NSIS build.
- [x] Add the Rust `x86_64-pc-windows-msvc` target and install `cargo-xwin`.
- [x] Keep all application source and existing user changes unchanged.

### Task 4: Build and verify Windows artifact

- [x] Build the Windows x64 NSIS `.exe` installer with Tauri and `cargo-xwin`.
- [x] Confirm the installer format and expected bundle contents.
- [x] Copy the verified installer into `release/installers/`.

### Task 5: Deliver packages

- [x] List exact filenames, architectures, sizes, and verification results.
- [x] Document the macOS Gatekeeper note for ad-hoc-signed local distribution.
