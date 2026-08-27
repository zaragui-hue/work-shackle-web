# Silent Work Status Success Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让工位状态自动切换成功时静默完成，同时保留失败通知与重试。

**Architecture:** 只修改自动切换 hook 的成功分支，不改变页面编排、通知组件、提醒完成标记或状态服务。成功时清理通知和失败上下文，失败时沿用现有错误通知。

**Tech Stack:** React 19、TypeScript、Vitest、Testing Library、Tauri 2

---

### Task 1: 自动切换成功静默

**Files:**
- Modify: `src/features/today/useWorkdayStatusAutomation.ts`
- Test: `src/features/today/useWorkdayStatusAutomation.test.tsx`

- [ ] **Step 1: 修改测试，要求首次成功不显示通知**

将成功用例改为等待状态服务调用，并断言成功通知不存在：

```tsx
it("switches a due reminder once without a success notice", async () => {
  vi.mocked(switchWorkStatus).mockResolvedValue({
    ...working,
    recordId: "r2",
    statusType: "meeting",
    emoji: "💻",
    name: "会议中",
  });
  renderHarness();

  await waitFor(() => expect(switchWorkStatus).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(/已自动切换/)).toBeNull();
});
```

- [ ] **Step 2: 修改测试，要求重试成功后错误通知消失**

在失败重试用例的成功阶段断言：

```tsx
await waitFor(() => expect(switchWorkStatus).toHaveBeenCalledTimes(2));
await waitFor(() => {
  expect(screen.queryByText("状态没切过去，工位拒绝配合")).toBeNull();
});
expect(screen.queryByText(/已自动切换/)).toBeNull();
expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
```

- [ ] **Step 3: 运行测试确认失败**

Run: `npm test -- --run src/features/today/useWorkdayStatusAutomation.test.tsx`

Expected: FAIL，因为当前成功分支会创建“已自动切换”通知。

- [ ] **Step 4: 实现成功分支静默**

将 `useWorkdayStatusAutomation.ts` 的成功分支改为：

```ts
try {
  await switchStatus(reminder.suggestedStatus);
  setFailedReminder(null);
  setNotice(null);
} catch {
  setFailedReminder(reminder);
  setNotice({
    tone: "error",
    title: "状态没切过去，工位拒绝配合",
    message: `原状态已保留。${reminder.label}可以手动重试。`,
  });
}
```

保留 `finally` 中的提醒完成标记、尝试 ID 清理与加载状态清理。

- [ ] **Step 5: 运行相关测试确认通过**

Run: `npm test -- --run src/features/today/useWorkdayStatusAutomation.test.tsx`

Expected: 2 tests PASS。

- [ ] **Step 6: 运行完整验证**

Run: `npm test && npm run build`

Expected: 所有 Vitest 测试通过，TypeScript 与 Vite 生产构建成功。

- [ ] **Step 7: 提交实现**

```bash
git add src/features/today/useWorkdayStatusAutomation.ts src/features/today/useWorkdayStatusAutomation.test.tsx
git commit -m "fix: silence successful status automation"
```

