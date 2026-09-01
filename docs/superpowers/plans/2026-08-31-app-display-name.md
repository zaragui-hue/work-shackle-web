# 精神状态事务所应用显示名称 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌面应用所有面向用户的应用名称统一为「精神状态事务所」，同时保留现有安装身份、用户数据和自动更新兼容性。

**Architecture:** 只修改 Tauri、HTML、Rust 描述和启动页中的显示名称，不修改 identifier、内部包名、存储键或更新端点。使用一个契约测试集中约束显示名称与兼容性字段，防止未来误把内部身份一起改掉。

**Tech Stack:** Tauri 2、React、TypeScript、Vitest、Rust Cargo 配置

**Execution constraint:** 用户要求本轮不执行 `git add`、`git commit`、`git push` 或发布操作；因此计划以本地检查点代替提交步骤。

---

### Task 1: 建立应用名称契约测试

**Files:**
- Create: `src/shared/shell/appDisplayNameContract.test.ts`
- Read: `src-tauri/tauri.conf.json`
- Read: `src-tauri/Cargo.toml`
- Read: `index.html`
- Read: `src/pages/StartupPanel.tsx`

- [ ] **Step 1: 写入失败测试**

创建 `src/shared/shell/appDisplayNameContract.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试并确认先失败**

Run: `npm test -- --run src/shared/shell/appDisplayNameContract.test.ts`

Expected: 第一个测试因 `productName` 或窗口标题仍为 `Work Shackle` 而失败；兼容性测试通过。

---

### Task 2: 修改用户可见名称

**Files:**
- Modify: `src-tauri/tauri.conf.json:3`
- Modify: `src-tauri/tauri.conf.json:15`
- Modify: `src-tauri/Cargo.toml:4`
- Modify: `index.html:7`
- Modify: `src/pages/StartupPanel.tsx:28`
- Test: `src/shared/shell/appDisplayNameContract.test.ts`

- [ ] **Step 1: 修改 Tauri 产品名和窗口标题**

将 `src-tauri/tauri.conf.json` 中两个用户可见字段改为：

```json
"productName": "精神状态事务所"
```

```json
"title": "精神状态事务所"
```

保持以下字段原样：

```json
"identifier": "com.workshackle.app"
```

- [ ] **Step 2: 修改 HTML、Cargo 和启动页名称**

`index.html`：

```html
<title>精神状态事务所</title>
```

`src-tauri/Cargo.toml`：

```toml
description = "精神状态事务所"
```

`src/pages/StartupPanel.tsx`：

```tsx
<p className="ws-startup__eyebrow">精神状态事务所</p>
```

- [ ] **Step 3: 运行名称契约测试**

Run: `npm test -- --run src/shared/shell/appDisplayNameContract.test.ts`

Expected: `2 passed`。

- [ ] **Step 4: 检查旧名称剩余位置**

Run: `rg -n "Work Shackle" src-tauri/tauri.conf.json src-tauri/Cargo.toml index.html src/pages/StartupPanel.tsx src/shared/shell/AppShell.tsx`

Expected: 无匹配。内部的 `work-shackle`、`com.workshackle.app` 和 GitHub 更新 URL 仍然存在，不做替换。

---

### Task 3: 完整验证与本地交付

**Files:**
- Verify: `src/shared/shell/appDisplayNameContract.test.ts`
- Verify: `src-tauri/tauri.conf.json`
- Verify: `src-tauri/Cargo.toml`
- Verify: `index.html`
- Verify: `src/pages/StartupPanel.tsx`

- [ ] **Step 1: 运行完整前端测试**

Run: `npm test -- --run`

Expected: 所有测试通过。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: TypeScript 与 Vite 构建成功。

- [ ] **Step 3: 运行 Tauri 原生配置检查**

Run: `cargo check --manifest-path src-tauri/Cargo.toml`

Expected: 编译检查成功；允许保留与本次改名无关的既有警告。

- [ ] **Step 4: 检查格式、兼容字段与 Git 状态**

Run: `git diff --check`

Expected: 无空白错误。

Run: `rg -n 'com\.workshackle\.app|work-shackle-web/releases/latest/download/latest\.json' src-tauri/tauri.conf.json`

Expected: identifier 与更新端点均有匹配。

Run: `git diff --cached --stat`

Expected: 无输出，确认本轮未暂存或提交任何文件。

- [ ] **Step 5: 本地交付说明**

报告显示名称已完成修改、验证结果以及当前已安装 App 尚未变化。若用户后续授权安装，再单独执行 Tauri 打包与本机安装；该动作不包含在本计划中。
