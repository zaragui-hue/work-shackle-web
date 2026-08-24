# Countdown Panel Height Reduction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将桌面端“距离下班还有”与“精神状态”双栏高度缩减 25%，保持两栏等高、内容完整，并保留现有移动端尺寸。

**Architecture:** 保留现有组件和基础样式，在 `861px` 以上增加明确的桌面端尺寸覆盖，避免影响 `860px` 以下的堆叠布局。使用 CSS 源码回归测试锁定面板高度、内部高度以及移动端原有尺寸，再通过真实页面截图检查裁切和视觉层级。

**Tech Stack:** React 19、TypeScript、CSS、Vitest、Vite、Agent Browser

---

## 文件结构

- 修改 `src/features/today/statusCockpitLayout.test.ts`：锁定桌面端 293px 等高布局、倒计时内部 269px 高度与移动端尺寸保护。
- 修改 `src/features/today/StatusCockpit.css`：压缩桌面端双栏、右侧插画和说明卡的空间占用。
- 修改 `src/features/today/WorkCountdownBanner.css`：压缩桌面端倒计时内部布局和字号，不改移动端规则。
- 修改 `src/pages/TodayPage.css`：让加载骨架在桌面端与新面板高度一致。

### Task 1: 添加桌面端高度回归测试

**Files:**
- Modify: `src/features/today/statusCockpitLayout.test.ts`
- Test: `src/features/today/statusCockpitLayout.test.ts`

- [ ] **Step 1: 写入失败测试**

在已有 `describe` 中读取倒计时 CSS，并加入下面的测试：

```ts
const countdown = readCss("src/features/today/WorkCountdownBanner.css");

it("reduces both desktop panels by one quarter without changing mobile heights", () => {
  expect(cockpit).toMatch(
    /@media\s*\(min-width:\s*861px\)[\s\S]*?\.status-cockpit__work\s*\{[^}]*min-height:\s*293px/,
  );
  expect(cockpit).toMatch(
    /@media\s*\(min-width:\s*861px\)[\s\S]*?\.status-cockpit__reaction\s*\{[^}]*min-height:\s*293px/,
  );
  expect(countdown).toMatch(
    /@media\s*\(min-width:\s*861px\)[\s\S]*?\.work-countdown\s*\{[^}]*min-height:\s*269px/,
  );
  expect(cockpit).toMatch(
    /@media\s*\(max-width:\s*860px\)[\s\S]*?\.status-cockpit__work\s*\{[^}]*min-height:\s*330px/,
  );
  expect(cockpit).toMatch(
    /@media\s*\(max-width:\s*860px\)[\s\S]*?\.status-cockpit__reaction\s*\{[^}]*min-height:\s*270px/,
  );
});
```

- [ ] **Step 2: 运行测试并确认失败**

运行：

```bash
npm test -- src/features/today/statusCockpitLayout.test.ts
```

预期：新增测试失败，因为尚不存在 `min-width: 861px` 的高度覆盖。

- [ ] **Step 3: 提交失败测试**

```bash
git add src/features/today/statusCockpitLayout.test.ts
git commit -m "test: lock desktop cockpit compact height"
```

### Task 2: 压缩桌面端双栏与内部内容

**Files:**
- Modify: `src/features/today/StatusCockpit.css`
- Modify: `src/features/today/WorkCountdownBanner.css`
- Modify: `src/pages/TodayPage.css`
- Test: `src/features/today/statusCockpitLayout.test.ts`

- [ ] **Step 1: 为双栏加入桌面端紧凑样式**

在 `StatusCockpit.css` 的移动端媒体查询之前加入：

```css
@media (min-width: 861px) {
  .status-cockpit__work {
    min-height: 293px;
    padding: 12px;
  }

  .status-cockpit__reaction {
    gap: 8px;
    min-height: 293px;
    padding: 12px;
  }

  .status-cockpit__meme {
    grid-template-columns: 96px minmax(0, 1fr);
    min-height: 210px;
  }

  .status-cockpit__mascot {
    width: 110px;
    height: 138px;
    margin-left: -8px;
    margin-bottom: -5px;
  }

  .status-cockpit__meme-mark {
    right: -18px;
    top: -52px;
    font-size: clamp(7.5rem, 12.75vw, 10.3125rem);
  }

  .status-cockpit__speech {
    margin-left: -4px;
    padding: 12px;
  }

  .status-cockpit__speech p {
    margin-top: 6px;
    font-size: clamp(1rem, 1.55vw, 1.1875rem);
  }

  .status-cockpit__reaction-skeleton {
    min-height: 117px;
  }
}
```

- [ ] **Step 2: 为倒计时加入桌面端紧凑样式**

在 `WorkCountdownBanner.css` 的移动端媒体查询之前加入：

```css
@media (min-width: 861px) {
  .work-countdown {
    gap: 6px;
    min-height: 269px;
  }

  .work-countdown__heading-row { gap: 12px; }
  .work-countdown__kicker { margin-bottom: 3px; }
  .work-countdown__headline { font-size: clamp(3rem, 5.175vw, 4.125rem); }
  .work-countdown__percent { margin-top: 10px; padding: 6px 9px; }
  .work-countdown__clock { gap: 14px; }
  .work-countdown__stack { gap: 8px; padding-bottom: 3px; }
  .work-countdown__digit { font-size: clamp(2.25rem, 4.05vw, 3.1875rem); }
  .work-countdown__digit--hours { font-size: clamp(6rem, 10.35vw, 8.25rem); }
  .work-countdown__progress { gap: 4px; }
  .work-countdown__track { height: 46px; }
}
```

- [ ] **Step 3: 同步桌面端加载骨架高度**

在 `TodayPage.css` 的响应式规则之前加入：

```css
@media (min-width: 861px) {
  .today-page__countdown-skeleton {
    min-height: 269px;
  }
}
```

- [ ] **Step 4: 运行聚焦测试并确认通过**

运行：

```bash
npm test -- src/features/today/statusCockpitLayout.test.ts src/styles/colorSystem.test.ts
```

预期：两个测试文件全部通过；原有色彩与品牌字体测试不受影响。

- [ ] **Step 5: 提交样式实现**

```bash
git add src/features/today/StatusCockpit.css src/features/today/WorkCountdownBanner.css src/pages/TodayPage.css
git commit -m "feat: compact desktop status cockpit"
```

### Task 3: 完整验证与视觉验收

**Files:**
- Verify: `src/features/today/StatusCockpit.css`
- Verify: `src/features/today/WorkCountdownBanner.css`
- Verify: `src/pages/TodayPage.css`

- [ ] **Step 1: 运行全部前端测试**

运行：

```bash
npm test
```

预期：全部测试通过，无回归。

- [ ] **Step 2: 运行生产构建**

运行：

```bash
npm run build
```

预期：TypeScript 检查和 Vite 构建成功。

- [ ] **Step 3: 在真实页面检查桌面端视觉**

启动或复用本地开发服务，使用 Agent Browser 打开今日页，在桌面宽度下截图并检查：

- 蓝色与橙色面板均约 293px 且严格等高。
- 倒计时标题、数字、进度条没有裁切或重叠。
- 右侧状态标签、吉祥物和说明卡完整可读。
- 浏览器控制台无新增错误。

- [ ] **Step 4: 检查移动端规则未改变**

将页面宽度调整到 `860px` 以下，确认布局仍堆叠，蓝色面板保持 330px、橙色面板保持 270px；完成后关闭本次打开的浏览器会话。

- [ ] **Step 5: 提交验证记录所需的最终修正（仅在视觉检查发现问题时）**

```bash
git add src/features/today/StatusCockpit.css src/features/today/WorkCountdownBanner.css src/pages/TodayPage.css src/features/today/statusCockpitLayout.test.ts
git commit -m "fix: refine compact cockpit spacing"
```
