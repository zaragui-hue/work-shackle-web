import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("desktop app version", () => {
  it("keeps the bootstrap updater version synchronized", () => {
    const packageJson = JSON.parse(read("package.json")) as { version: string };
    const tauriConfig = JSON.parse(read("src-tauri/tauri.conf.json")) as {
      version: string;
    };
    const cargoToml = read("src-tauri/Cargo.toml");

    expect(packageJson.version).toBe("0.1.2");
    expect(tauriConfig.version).toBe("0.1.2");
    expect(cargoToml).toMatch(
      /\[package\][\s\S]*?version\s*=\s*"0\.1\.2"/,
    );
  });
});
