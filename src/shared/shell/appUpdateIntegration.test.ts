import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

type Capability = {
  windows: string[];
  permissions: string[];
};

type TauriConfig = {
  bundle: { createUpdaterArtifacts?: boolean };
  plugins?: {
    updater?: {
      pubkey?: string;
      endpoints?: string[];
    };
  };
};

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("in-app updater integration", () => {
  it("renders the updater through the existing avatar position", () => {
    const shellSource = read("src/shared/shell/AppShell.tsx");

    expect(shellSource).toContain("useAppUpdate()");
    expect(shellSource).toContain("<AppUpdateAvatar");
    expect(shellSource).not.toContain('<span className="ws-shell__logo"');
  });

  it("initializes native updater and process plugins", () => {
    const libSource = read("src-tauri/src/lib.rs");

    expect(libSource).toContain(
      "tauri_plugin_updater::Builder::new().build()",
    );
    expect(libSource).toContain("tauri_plugin_process::init()");
  });

  it("limits update installation permission to the main window", () => {
    const mainCapability = JSON.parse(
      read("src-tauri/capabilities/default.json"),
    ) as Capability;
    const reminderCapability = JSON.parse(
      read("src-tauri/capabilities/reminder.json"),
    ) as Capability;

    expect(mainCapability.windows).toEqual(["main"]);
    expect(mainCapability.permissions).toContain("updater:default");
    expect(mainCapability.permissions).toContain("process:allow-restart");
    expect(reminderCapability.windows).toEqual(["ddl-reminder"]);
    expect(reminderCapability.permissions).not.toContain("updater:default");
    expect(reminderCapability.permissions).not.toContain(
      "process:allow-restart",
    );
  });

  it("creates signed updater artifacts from the GitHub release endpoint", () => {
    const tauriConfig = JSON.parse(
      read("src-tauri/tauri.conf.json"),
    ) as TauriConfig;

    expect(tauriConfig.bundle.createUpdaterArtifacts).toBe(true);
    expect(tauriConfig.plugins?.updater?.endpoints).toContain(
      "https://github.com/zaragui-hue/work-shackle-web/releases/latest/download/latest.json",
    );
    expect(tauriConfig.plugins?.updater?.pubkey?.length).toBeGreaterThan(40);
  });
});
