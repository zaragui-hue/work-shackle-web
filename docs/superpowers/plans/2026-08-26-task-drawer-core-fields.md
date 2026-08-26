# Task Drawer Core Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让任务详情抽屉与新建任务使用同一套核心字段，同时保留已有任务的进度、状态、延期、提醒和终止操作。

**Architecture:** 提取无业务提交逻辑的 `TaskCoreFields` 展示组件，由新建和编辑表单分别传入 React Hook Form 注册器、错误与禁用状态。扩展详情表单映射和更新输入，使现有 `updateTask` 一次保存全部核心字段；详情专属管理能力留在 `TaskDrawer` 内。

**Tech Stack:** React 19、TypeScript、React Hook Form、Zod、Vitest、Testing Library、Vite

---

## 文件结构

- Create `src/features/tasks/TaskCoreFields.tsx`：共享核心字段的固定顺序、标签与控件。
- Create `src/features/tasks/TaskCoreFields.css`：共享任务时间段视觉样式。
- Create `src/features/tasks/taskDrawerForm.test.ts`：详情表单映射、校验和更新输入测试。
- Create `src/features/tasks/TaskDrawer.test.tsx`：详情抽屉字段与保存行为测试。
- Modify `src/features/tasks/createTaskForm.ts`：导出可复用的核心字段校验定义。
- Modify `src/features/tasks/CreateTaskDrawer.tsx`：使用共享核心字段组件。
- Modify `src/features/tasks/CreateTaskDrawer.css`：只保留抽屉提交错误与容器布局。
- Modify `src/features/tasks/taskDrawerForm.ts`：加入核心字段、详情映射与完整更新输入。
- Modify `src/features/tasks/TaskDrawer.tsx`：按新建字段排列核心区，重排详情管理区。
- Modify `src/features/tasks/TaskDrawer.css`：管理区与延期操作布局。

### Task 1: 锁定详情表单数据契约

**Files:**
- Create: `src/features/tasks/taskDrawerForm.test.ts`
- Modify: `src/features/tasks/taskDrawerForm.ts`

- [ ] **Step 1: 写入失败测试**

测试应构造包含名称、备注、开始/完成时间、优先级、状态、联系人 ID 与快照的 `TaskDetail`，并断言：

```ts
expect(taskDetailToFormValues(detail)).toEqual({
  title: "整理季度复盘",
  note: "带数据",
  startAt: "2026-08-26T09:00",
  endAt: "2026-08-26T18:00",
  priority: 4,
  contactName: "小王",
  status: "in_progress",
});

expect(toUpdateTaskInput(detail.task, values)).toEqual({
  id: "task-1",
  title: "改后的任务",
  note: "更新备注",
  plannedAtMs: new Date("2026-08-26T10:00").getTime(),
  deadlineAtMs: new Date("2026-08-26T19:00").getTime(),
  priority: 5,
  status: "paused",
  contactId: null,
  contactSnapshot: "新对接人",
});
```

再断言完成时间早于或等于开始时间时 `taskDrawerFormSchema.safeParse` 失败。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/features/tasks/taskDrawerForm.test.ts`

Expected: FAIL，详情表单尚无核心字段。

- [ ] **Step 3: 扩展详情表单**

在 `taskDrawerForm.ts` 中使用与创建表单一致的字段定义，表单结构为：

```ts
{
  title: string;
  note?: string;
  startAt: string;
  endAt: string;
  priority: number;
  contactName?: string;
  status: TaskStatus;
}
```

`taskDetailToFormValues` 从任务详情填充全部字段；`toUpdateTaskInput` 转换本地时间，修剪文本，并在联系人名称变化时清除 `contactId`，未变化时保留它。

- [ ] **Step 4: 运行测试并确认通过**

Run: `npm test -- src/features/tasks/taskDrawerForm.test.ts src/features/tasks/createTaskForm.test.ts`

Expected: PASS。

- [ ] **Step 5: 提交数据契约**

```bash
git add src/features/tasks/createTaskForm.ts src/features/tasks/taskDrawerForm.ts src/features/tasks/taskDrawerForm.test.ts
git commit -m "feat: expand task detail form fields"
```

### Task 2: 提取共享核心字段组件

**Files:**
- Create: `src/features/tasks/TaskCoreFields.tsx`
- Create: `src/features/tasks/TaskCoreFields.css`
- Modify: `src/features/tasks/CreateTaskDrawer.tsx`
- Modify: `src/features/tasks/CreateTaskDrawer.css`
- Test: `src/features/tasks/CreateTaskDrawer.test.tsx`

- [ ] **Step 1: 加强新建抽屉回归测试**

在现有渲染测试中按顺序查询标签，并断言核心字段为：

```ts
const labels = Array.from(document.querySelectorAll(".ws-field__label"))
  .map((label) => label.textContent?.trim());
expect(labels).toEqual([
  "任务名称",
  "备注",
  "开始时间",
  "完成时间",
  "紧急程度",
  "对接人",
]);
```

- [ ] **Step 2: 创建共享组件**

`TaskCoreFields` 接收 `register`、`errors`、`disabled` 和 `autoFocusTitle`，固定渲染：

```tsx
<Input label="任务名称" placeholder="今天要搬哪块砖" />
<Textarea label="备注" placeholder="可选" rows={2} />
<section className="task-core-fields__time-range">
  <h3>任务时间段</h3>
  <Input label="开始时间" type="datetime-local" step={60} />
  <Input label="完成时间" type="datetime-local" step={60} />
</section>
<Select label="紧急程度">...</Select>
<Input label="对接人" placeholder="可选，输入姓名" />
```

组件只负责渲染，不创建表单、不提交数据。

- [ ] **Step 3: 新建抽屉接入共享组件**

删除 `CreateTaskDrawer.tsx` 内重复的六个控件，替换为：

```tsx
<TaskCoreFields
  register={register}
  errors={errors}
  autoFocusTitle
/>
```

把任务时间段样式迁移到 `TaskCoreFields.css`。

- [ ] **Step 4: 运行新建抽屉测试**

Run: `npm test -- src/features/tasks/CreateTaskDrawer.test.tsx`

Expected: PASS。

- [ ] **Step 5: 提交共享字段组件**

```bash
git add src/features/tasks/TaskCoreFields.tsx src/features/tasks/TaskCoreFields.css src/features/tasks/CreateTaskDrawer.tsx src/features/tasks/CreateTaskDrawer.css src/features/tasks/CreateTaskDrawer.test.tsx
git commit -m "refactor: share task core fields"
```

### Task 3: 重构任务详情抽屉

**Files:**
- Create: `src/features/tasks/TaskDrawer.test.tsx`
- Modify: `src/features/tasks/TaskDrawer.tsx`
- Modify: `src/features/tasks/TaskDrawer.css`

- [ ] **Step 1: 写入详情抽屉失败测试**

模拟 `getTaskDetail` 与 `updateTask`，打开 `TaskDrawer` 后断言“任务名称、备注、开始时间、完成时间、紧急程度、对接人”均存在，且修改后点击保存会传入完整更新输入。另构造 `completed` 任务，断言核心字段全部禁用。

- [ ] **Step 2: 运行测试并确认失败**

Run: `npm test -- src/features/tasks/TaskDrawer.test.tsx`

Expected: FAIL，详情抽屉尚未渲染共享字段。

- [ ] **Step 3: 接入共享字段并重排管理区**

将抽屉标题设为“任务详情”，删除旧的任务概览、独立 DDL 输入、重复备注和 `ContactPicker`。表单顶部加入：

```tsx
<TaskCoreFields
  register={register}
  errors={errors}
  disabled={terminal || isSubmitting}
/>
```

其后依次保留进度、延期按钮、主状态、延期记录、提醒和终态提示。进度使用表单初始任务时间；延期成功后继续重新加载详情。

- [ ] **Step 4: 调整详情管理区样式**

删除不再使用的 hero、deadline 输入样式，新增紧凑的管理分组和延期操作行，确保抽屉主体仍为单列且底部操作不变。

- [ ] **Step 5: 运行详情测试并确认通过**

Run: `npm test -- src/features/tasks/TaskDrawer.test.tsx src/features/tasks/taskDrawerForm.test.ts`

Expected: PASS。

- [ ] **Step 6: 提交详情抽屉改造**

```bash
git add src/features/tasks/TaskDrawer.tsx src/features/tasks/TaskDrawer.css src/features/tasks/TaskDrawer.test.tsx
git commit -m "feat: align task drawer fields"
```

### Task 4: 完整验证

**Files:**
- Verify: all frontend files

- [ ] **Step 1: 运行完整前端测试**

Run: `npm test`

Expected: 全部测试通过。

- [ ] **Step 2: 运行生产构建**

Run: `npm run build`

Expected: TypeScript 检查和 Vite 构建成功。

- [ ] **Step 3: 页面验收**

在本地 App 中依次打开新建任务与现有任务，确认核心字段顺序一致；编辑现有任务并保存，确认列表同步刷新；检查终态任务只读及延期、提醒、进度区域仍存在。

- [ ] **Step 4: 确认工作区状态**

Run: `git status --short`

Expected: 没有未提交的本功能变更。
