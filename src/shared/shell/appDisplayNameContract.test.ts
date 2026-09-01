import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const tauriConfig = JSON.parse(
  readFileSync(resolve(root, "src-tauri/tauri.conf.json"), "utf8"),
) as {
  productName: string;
  identifier: string;
  app: { windows: Array<{ title: string }> };
  plugins: { updater: { endpoints: string[] } };
};

describe("app display name contract", () => {
  it("uses 精神状态事务所 for every user-facing app name", () => {
    const html = readFileSync(resolve(root, "index.html"), "utf8");
    const cargo = readFileSync(resolve(root, "src-tauri/Cargo.toml"), "utf8");
    const startupPanel = readFileSync(
      resolve(root, "src/pages/StartupPanel.tsx"),
      "utf8",
    );

    expect(tauriConfig.productName).toBe("精神状态事务所");
    expect(tauriConfig.app.windows[0]?.title).toBe("精神状态事务所");
    expect(html).toContain("<title>精神状态事务所</title>");
    expect(cargo).toContain('description = "精神状态事务所"');
    expect(startupPanel).toContain(">精神状态事务所</p>");
  });

  it("preserves the existing app identity and updater endpoint", () => {
    expect(tauriConfig.identifier).toBe("com.workshackle.app");
    expect(tauriConfig.plugins.updater.endpoints).toContain(
      "https://github.com/zaragui-hue/work-shackle-web/releases/latest/download/latest.json",
    );
  });
});
