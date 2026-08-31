# 距离释放每小时文案轮换 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让工作中“距离释放”的主文案按距离下班阶段匹配语气，并在每个自然整点稳定更换。

**Architecture:** 文案阶段、文案池和稳定选句逻辑集中在现有 `workCountdown.ts` 领域模块中，`computeWorkCountdown` 使用工作日期、当前本地小时和剩余毫秒计算主文案。展示组件继续只读取 `primaryText`，无需增加状态或持久化。

**Tech Stack:** TypeScript、React、Vitest、Vite

---

## 文件结构

- Modify: `src/features/today/workCountdown.ts` — 定义剩余时间阶段、赛博反讽文案池、稳定索引和工作中主文案选择。
- Modify: `src/features/today/workCountdown.test.ts` — 覆盖四阶段边界、自然整点轮换、同小时稳定及现有倒计时行为。

### Task 1: 用测试锁定按剩余时间分层和自然整点轮换

**Files:**
- Modify: `src/features/today/workCountdown.test.ts`

- [ ] **Step 1: 替换旧进度分段测试并添加小时轮换测试**

在测试中改为导入新的选句参数，并增加以下行为断言：

```ts
it("matches copy stages to the remaining time", () => {
  expect(workCountdownHeadline("2026-08-14", 7 * 60 * 60 * 1000, localMs(10, 0)))
    .toMatch(/系统|工位|下班/);
  expect(workCountdownHeadline("2026-08-14", 6 * 60 * 60 * 1000, localMs(11, 0)))
    .toMatch(/班味|进度|工位/);
  expect(workCountdownHeadline("2026-08-14", 3 * 60 * 60 * 1000, localMs(12, 0)))
    .toMatch(/越狱|权限|释放/);
  expect(workCountdownHeadline("2026-08-14", 60 * 60 * 1000 - 1, localMs(17, 0)))
    .toMatch(/关机|门禁|撤离/);
});

it("keeps copy stable within an hour and changes at the next clock hour", () => {
  const before = workCountdownHeadline(
    "2026-08-14",
    5 * 60 * 60 * 1000,
    localMs(10, 1),
  );
  const sameHour = workCountdownHeadline(
    "2026-08-14",
    5 * 60 * 60 * 1000 - 30 * 60 * 1000,
    localMs(10, 31),
  );
  const nextHour = workCountdownHeadline(
    "2026-08-14",
    4 * 60 * 60 * 1000,
    localMs(11, 0),
  );

  expect(sameHour).toBe(before);
  expect(nextHour).not.toBe(before);
});
```

同时把工作时段集成断言从固定旧句改为验证对应阶段的新句，并保留上班前、下班后、秒级倒计时和临时工时测试。

- [ ] **Step 2: 运行领域测试确认失败**

Run: `npm test -- --run src/features/today/workCountdown.test.ts`

Expected: FAIL，因为 `workCountdownHeadline` 仍接收旧的进度参数，尚未实现小时级选句。

- [ ] **Step 3: 提交测试约束**

```bash
git add src/features/today/workCountdown.test.ts
git commit -m "test: define hourly countdown copy rotation"
```

### Task 2: 实现四阶段赛博反讽文案池

**Files:**
- Modify: `src/features/today/workCountdown.ts`
- Test: `src/features/today/workCountdown.test.ts`

- [ ] **Step 1: 定义文案阶段和各阶段文案池**

在 `workCountdown.ts` 中加入四组互不重复的文案：

```ts
const WORK_COUNTDOWN_HEADLINES = {
  distant: [
    "系统提示：距离下班还远，建议先假装热爱工作",
    "工位已锁定，今日自由仍在排队加载",
    "下班节点尚未渲染，先维持人类在线状态",
    "赛博工牌持续发热，释放权限暂未下发",
  ],
  middle: [
    "班味进度过半，灵魂继续低功耗运行",
    "今日副本已刷一半，奖励是继续上班",
    "工位续费成功，自由体验版稍后开放",
    "进度条看着挺快，人生加载得另说",
  ],
  near: [
    "释放协议开始握手，请勿提前暴露笑容",
    "下班权限正在同步，工位封印已有裂纹",
    "赛博越狱进入读条，保持无事发生的表情",
    "自由信号已搜到，老板信号请继续屏蔽",
  ],
  final: [
    "关机程序已启动，肉身准备撤离",
    "门禁即将失守，请把灵魂塞回身体",
    "最后一格班味，清空后立即逃生",
    "撤离倒计时已上线，禁止临时加需求",
  ],
} as const;
```

- [ ] **Step 2: 实现阶段判断和稳定索引**

用精确毫秒边界选择阶段，并用工作日期字符和当前本地小时形成稳定索引：

```ts
function countdownCopyStage(remainingMs: number): keyof typeof WORK_COUNTDOWN_HEADLINES {
  const hours = remainingMs / (60 * 60 * 1000);
  if (hours > 6) return "distant";
  if (hours > 3) return "middle";
  if (hours >= 1) return "near";
  return "final";
}

export function workCountdownHeadline(
  workDate: string,
  remainingMs: number,
  nowMs: number,
): string {
  const pool = WORK_COUNTDOWN_HEADLINES[countdownCopyStage(remainingMs)];
  const dateSeed = [...workDate].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const hour = new Date(nowMs).getHours();
  return pool[(dateSeed + hour) % pool.length];
}
```

- [ ] **Step 3: 接入工作中倒计时计算**

在 `computeWorkCountdown` 的工作中分支使用新的选句函数：

```ts
return {
  phase: "working",
  primaryText: workCountdownHeadline(schedule.workDate, remainingMs, nowMs),
  countdownText: formatHmsCountdown(remainingMs),
};
```

移除不再使用的工作进度百分比文案判断；进度条自身仍由展示层的 `getWorkdayProgress` 计算，不受影响。

- [ ] **Step 4: 运行领域测试确认通过**

Run: `npm test -- --run src/features/today/workCountdown.test.ts`

Expected: PASS，四阶段边界、同小时稳定、跨整点变化和原有倒计时行为全部通过。

- [ ] **Step 5: 提交实现**

```bash
git add src/features/today/workCountdown.ts src/features/today/workCountdown.test.ts
git commit -m "feat: rotate countdown copy every hour"
```

### Task 3: 回归验证

**Files:**
- Verify: `src/features/today/WorkCountdownBanner.tsx`
- Verify: `src/features/today/WorkCountdownBanner.test.tsx`

- [ ] **Step 1: 运行倒计时展示和领域测试**

Run: `npm test -- --run src/features/today/workCountdown.test.ts src/features/today/WorkCountdownBanner.test.tsx`

Expected: PASS，展示组件仍正确显示 `primaryText`、时分秒和工作进度。

- [ ] **Step 2: 运行完整测试套件**

Run: `npm test`

Expected: 所有测试通过。

- [ ] **Step 3: 运行生产构建**

Run: `npm run build`

Expected: TypeScript 检查和 Vite 构建成功。

- [ ] **Step 4: 检查补丁格式**

Run: `git diff --check`

Expected: 无空白错误。
