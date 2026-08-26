# Task Drawer Autosave Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 删除任务详情提醒和保存按钮，以字段级自动保存替代，并把延期移动到与取消、完成并列的底部操作区。

**Architecture:** `TaskCoreFields` 通过可选回调暴露文本/时间字段失焦和选择字段变更事件，新建抽屉不传回调，详情抽屉据此触发完整表单校验。`TaskDrawer` 使用 Promise 队列串行调用现有 `updateTask`，按表单快照去重，不在保存成功后重置表单；底部任务级动作先等待当前表单保存完成。

**Tech Stack:** React 19、TypeScript、React Hook Form、Zod、Vitest、Testing Library、Vite

---

## 文件结构

- Modify `src/features/tasks/TaskCoreFields.tsx`：统一分钟级日期时间选择器、接头人文案和自动保存事件出口。
- Modify `src/features/tasks/CreateTaskDrawer.test.tsx`：锁定接头人文案与日期时间控件。
- Modify `src/features/tasks/TaskDrawer.tsx`：字段级自动保存队列、状态文案、提醒删除和底部动作重排。
- Modify `src/features/tasks/TaskDrawer.css`：自动保存提示、精简管理标题和底部延期按钮视觉区分。
- Modify `src/features/tasks/TaskDrawer.test.tsx`：自动保存、布局、去重、错误和终态回归测试。

### Task 1: 统一时间选择器与接头人文案

**Files:**
- Modify: `src/features/tasks/TaskCoreFields.tsx`
- Modify: `src/features/tasks/CreateTaskDrawer.test.tsx`

- [ ] **Step 1: 写入失败测试**

在新建抽屉渲染测试中加入：

```tsx
expect(screen.getByLabelText("开始时间").getAttribute("type")).toBe("datetime-local");
expect(screen.getByLabelText("开始时间").getAttribute("step")).toBe("60");
expect(screen.getByLabelText("完成时间").getAttribute("type")).toBe("datetime-local");
expect(screen.getByLabelText("完成时间").getAttribute("step")).toBe("60");
expect(screen.getByLabelText("🕵️ 接头人").getAttribute("placeholder"))
  .toBe("输入本次行动的秘密联络人");
```

字段顺序断言的最后一项改为 `🕵️ 接头人`。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/features/tasks/CreateTaskDrawer.test.tsx`

Expected: FAIL，页面仍显示“对接人”。

- [ ] **Step 3: 扩展共享字段事件契约并修改文案**

为 `TaskCoreFieldsProps` 增加：

```ts
onFieldBlur?: () => void;
onSelectChange?: () => void;
```

任务名称、备注、开始时间、完成时间、接头人的 `register` 选项传入 `onBlur: onFieldBlur`；紧急程度传入 `onChange: onSelectChange`。对接人控件改为：

```tsx
<Input
  label="🕵️ 接头人"
  placeholder="输入本次行动的秘密联络人"
  {...register(path<T>("contactName"), { onBlur: onFieldBlur })}
/>
```

两个日期时间控件保持 `type="datetime-local"`、`step={60}`。

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test -- src/features/tasks/CreateTaskDrawer.test.tsx`

Expected: PASS。

- [ ] **Step 5: 提交共享字段改造**

```bash
git add src/features/tasks/TaskCoreFields.tsx src/features/tasks/CreateTaskDrawer.test.tsx
git commit -m "feat: style task contact as secret liaison"
```

### Task 2: 定义任务抽屉自动保存行为

**Files:**
- Modify: `src/features/tasks/TaskDrawer.test.tsx`
- Modify: `src/features/tasks/TaskDrawer.tsx`

- [ ] **Step 1: 写入自动保存失败测试**

替换按钮保存测试，验证失焦保存：

```tsx
fireEvent.change(screen.getByLabelText("任务名称"), {
  target: { value: "改后的任务" },
});
fireEvent.blur(screen.getByLabelText("任务名称"));
await waitFor(() => expect(updateTask).toHaveBeenCalledTimes(1));
expect(updateTask).toHaveBeenCalledWith(expect.objectContaining({
  title: "改后的任务",
}));
```

加入紧急程度变更立即保存、未修改字段失焦不保存、保存按钮不存在、保存中/成功状态文案的断言。模拟拒绝的 `updateTask`，断言错误可见且当前输入不被重置。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/features/tasks/TaskDrawer.test.tsx`

Expected: FAIL，现有抽屉仍依赖保存按钮。

- [ ] **Step 3: 实现串行自动保存队列**

从 `useForm` 取得 `getValues` 与 `trigger`。在 `TaskDrawer` 中建立以下引用：

```ts
const mountedRef = useRef(true);
const latestTaskRef = useRef<Task | null>(null);
const lastSavedKeyRef = useRef("");
const saveChainRef = useRef<Promise<void>>(Promise.resolve());
const saveByKeyRef = useRef(new Map<string, Promise<boolean>>());
```

加载详情时以 `JSON.stringify(taskDetailToFormValues(next))` 初始化成功快照。`enqueueSave(values)` 若快照已成功或正在排队则直接复用结果，否则把请求接到 `saveChainRef` 后：显示“正在传递情报…”，调用 `updateTask(toUpdateTaskInput(latestTaskRef.current, values))`，成功后更新任务引用、成功快照、显示“情报已同步”并调用 `onChanged`；失败时保留表单并设置映射错误。无论成功失败都从 `saveByKeyRef` 删除该快照。

`requestAutoSave` 先执行：

```ts
const valid = await trigger();
if (!valid) return false;
return enqueueSave(getValues());
```

把 `requestAutoSave` 传给 `TaskCoreFields` 的 `onFieldBlur`；`onSelectChange` 使用 `queueMicrotask(() => void requestAutoSave())`，确保 React Hook Form 已接收新值。主状态注册时使用相同的选择变更回调。

- [ ] **Step 4: 移除提交式保存**

删除 `handleSubmit`、`onSubmit`、`isSubmitting` 和 footer 中的保存按钮。表单仅保留结构：

```tsx
<form id="task-drawer-form" className="task-drawer__form">
```

在核心字段后渲染：

```tsx
{saveStatus === "saving" ? <p className="task-drawer__save-status">正在传递情报…</p> : null}
{saveStatus === "saved" ? <p className="task-drawer__save-status">情报已同步</p> : null}
```

- [ ] **Step 5: 运行自动保存测试并确认通过**

Run: `npm test -- src/features/tasks/TaskDrawer.test.tsx`

Expected: 自动保存相关测试通过。

- [ ] **Step 6: 提交自动保存行为**

```bash
git add src/features/tasks/TaskDrawer.tsx src/features/tasks/TaskDrawer.test.tsx
git commit -m "feat: autosave task drawer fields"
```

### Task 3: 删除提醒并重排底部动作

**Files:**
- Modify: `src/features/tasks/TaskDrawer.tsx`
- Modify: `src/features/tasks/TaskDrawer.css`
- Modify: `src/features/tasks/TaskDrawer.test.tsx`

- [ ] **Step 1: 写入布局失败测试**

详情加载后断言：

```tsx
expect(screen.queryByText("自定义提醒")).toBeNull();
expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
expect(screen.getByRole("button", { name: "取消任务" })).toBeTruthy();
expect(screen.getByRole("button", { name: "申请延期" })).toBeTruthy();
expect(screen.getByRole("button", { name: "完成任务" })).toBeTruthy();
expect(document.querySelector(".ws-drawer__footer .task-drawer__postpone-btn")).toBeTruthy();
expect(document.querySelector(".task-drawer__management .task-drawer__postpone-btn")).toBeNull();
```

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/features/tasks/TaskDrawer.test.tsx`

Expected: FAIL，提醒仍显示且延期仍在任务管理区。

- [ ] **Step 3: 删除提醒并调整底部操作**

删除 `formatReminderTime` 引入和自定义提醒 JSX。任务管理标题只保留 `任务管理`。footer 改为：

```tsx
<Button variant="secondary" onClick={() => void handleCancelTask()}>取消任务</Button>
{canPostpone ? (
  <Button variant="wheat" className="task-drawer__postpone-btn" onClick={() => void handleOpenPostpone()}>
    申请延期
  </Button>
) : null}
<Button onClick={() => void handleComplete()}>完成任务</Button>
```

`handleCancelTask`、`handleOpenPostpone`、`handleComplete` 在执行任务动作前等待 `requestAutoSave()`；校验失败或保存失败时中止任务动作。

- [ ] **Step 4: 清理和补充样式**

删除 `.task-drawer__reminder-list` 相关规则。管理标题改为普通单标题布局；添加：

```css
.task-drawer__save-status {
  min-height: 1.2em;
  margin: calc(var(--space-2) * -1) 0 0;
  font-size: var(--font-size-caption);
  color: var(--color-ink-muted);
  text-align: right;
}

.ws-drawer__footer .task-drawer__postpone-btn {
  border-style: dashed;
}
```

- [ ] **Step 5: 运行详情抽屉测试**

Run: `npm test -- src/features/tasks/TaskDrawer.test.tsx src/features/tasks/CreateTaskDrawer.test.tsx`

Expected: PASS。

- [ ] **Step 6: 提交布局改造**

```bash
git add src/features/tasks/TaskDrawer.tsx src/features/tasks/TaskDrawer.css src/features/tasks/TaskDrawer.test.tsx
git commit -m "feat: simplify task drawer actions"
```

### Task 4: 完整验证

**Files:**
- Verify: all frontend files

- [ ] **Step 1: 运行完整前端测试**

Run: `npm test`

Expected: 全部测试通过。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: TypeScript 检查与 Vite 构建成功。

- [ ] **Step 3: 检查变更完整性**

Run: `git diff --check && git status --short`

Expected: 无空白错误，且没有未提交的本功能文件。
