# 设置页面板精简 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 从设置页删除“今日工作时间”和“日历忙碌状态”配置面板，同时保留默认时间、午餐、状态文案、今日页临时时间和日历忙碌展示。

**Architecture:** 只修改设置页的组合层和该页面专属样式，不删除底层接口或忙碌规则功能模块。用源码结构契约测试锁定设置页入口的存在与缺失，再运行现有今日页、忙碌规则和日历测试确认保留功能未受影响。

**Tech Stack:** React、TypeScript、React Hook Form、Vitest、Vite

---

## 文件结构

- Create: `src/pages/settingsPageStructure.test.ts` — 验证设置页保留与删除的入口边界。
- Modify: `src/pages/SettingsPage.tsx` — 删除两个配置面板和今日临时时间专属逻辑，更新页面说明。
- Modify: `src/pages/SettingsPage.css` — 删除只服务于今日临时时间卡片和弹窗的样式。

### Task 1: 用结构测试锁定设置页精简范围

**Files:**
- Create: `src/pages/settingsPageStructure.test.ts`

- [ ] **Step 1: 创建会失败的设置页结构测试**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const settingsPage = readFileSync(
  join(process.cwd(), "src/pages/SettingsPage.tsx"),
  "utf8",
);

describe("SettingsPage structure", () => {
  it("keeps the supported time and status settings", () => {
    expect(settingsPage).toContain("默认工作时间");
    expect(settingsPage).toContain("午餐时间");
    expect(settingsPage).toContain("<StatusCopySection />");
  });

  it("removes today's override controls from settings only", () => {
    expect(settingsPage).not.toContain("今日工作时间");
    expect(settingsPage).not.toContain("saveTodayWorkOverride");
    expect(settingsPage).not.toContain("clearTodayWorkOverride");
    expect(settingsPage).not.toContain("today-work-override-form");
  });

  it("removes the busy rule configuration entry", () => {
    expect(settingsPage).not.toContain("BusyRuleSection");
    expect(settingsPage).not.toContain("日历忙碌状态");
  });
});
```

- [ ] **Step 2: 运行测试确认删除约束失败**

Run: `npm test -- --run src/pages/settingsPageStructure.test.ts`

Expected: FAIL，当前源码仍包含今日临时时间接口、弹窗表单和 `BusyRuleSection`。

### Task 2: 删除设置页入口和专属逻辑

**Files:**
- Modify: `src/pages/SettingsPage.tsx`
- Test: `src/pages/settingsPageStructure.test.ts`

- [ ] **Step 1: 精简导入和页面状态**

从 `SettingsPage.tsx` 删除：

```ts
import { BusyRuleSection } from "../features/settings/BusyRuleSection";
```

并从设置服务导入中删除：

```ts
clearTodayWorkOverride,
saveTodayWorkOverride,
type WorkSchedule,
```

把 UI 导入从：

```ts
import { Button, Card, Input, Mascot, Modal } from "../shared/ui";
```

改为：

```ts
import { Button, Card, Input, Mascot } from "../shared/ui";
```

删除 `schedule`、`todayActionError`、`overrideModalOpen`、`overrideSubmitError` 状态和 `overrideForm`。加载日程后直接用返回值重置默认表单，不再调用 `setSchedule(next)`；保存默认时间后同样只重置默认表单。

- [ ] **Step 2: 删除今日临时时间处理器和表单字段解构**

删除 `onSaveTodayOverride`、`onClearTodayOverride`、弹窗打开时重置表单的 `useEffect`，以及以下解构：

```ts
const {
  register: registerOverride,
  formState: { errors: overrideErrors, isSubmitting: isSavingOverride },
} = overrideForm;
```

- [ ] **Step 3: 删除两个配置面板并更新说明**

把顶部说明改为：

```tsx
<p>这里负责调整默认时间、午餐和状态文案，不负责说服老板。</p>
```

删除完整的 `settings-work-time--today` 卡片、页面末尾的：

```tsx
{!loading && !loadError ? <BusyRuleSection /> : null}
```

以及整个 `<Modal>` 今日临时调整弹窗。组件最终直接返回单个 `<Card>`，不再需要空 Fragment。

- [ ] **Step 4: 运行结构测试确认通过**

Run: `npm test -- --run src/pages/settingsPageStructure.test.ts`

Expected: PASS，保留项存在，两个删除项及其专属逻辑均不存在。

### Task 3: 清理页面专属样式并验证保留功能

**Files:**
- Modify: `src/pages/SettingsPage.css`
- Verify: `src/features/today/WorkScheduleEditor.test.tsx`
- Verify: `src/features/settings/BusyRuleSection.test.tsx`
- Verify: `src/features/tasks/calendar/TaskCalendar.test.tsx`

- [ ] **Step 1: 删除已经失去使用者的今日时间样式**

从 `SettingsPage.css` 删除：

```css
.settings-work-time--today {
  margin-top: var(--space-2);
}

.settings-work-time--modal {
  padding: 0;
  background: transparent;
  border: 0;
}
```

保留 `.settings-work-time__effective`，因为午餐时间仍使用它；保留忙碌规则组件自己的样式和服务。

- [ ] **Step 2: 运行设置页及保留功能的专项测试**

Run: `npm test -- --run src/pages/settingsPageStructure.test.ts src/features/today/WorkScheduleEditor.test.tsx src/features/settings/BusyRuleSection.test.tsx src/features/tasks/calendar/TaskCalendar.test.tsx`

Expected: PASS，设置页入口已删除，今日页临时时间、忙碌规则模块和日历忙碌展示仍正常。

- [ ] **Step 3: 运行完整测试套件**

Run: `npm test`

Expected: 所有测试通过。

- [ ] **Step 4: 运行生产构建**

Run: `npm run build`

Expected: TypeScript 检查和 Vite 构建成功。

- [ ] **Step 5: 检查补丁格式并提交**

```bash
git diff --check
git add src/pages/SettingsPage.tsx src/pages/SettingsPage.css src/pages/settingsPageStructure.test.ts
git commit -m "feat: simplify settings panels"
```
