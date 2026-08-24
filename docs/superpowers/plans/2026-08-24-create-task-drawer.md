# Create Task Drawer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将“今日”页的新建任务交互改为右侧抽屉，并从“任务”页彻底移除新建入口。

**Architecture:** 把现有新建表单从 `Modal` 容器迁移到独立的 `CreateTaskDrawer`，保留表单、服务调用和回调契约。今日页只替换创建组件；任务页删除创建状态、按钮和组件，仅保留任务浏览与详情抽屉。

**Tech Stack:** React 19、TypeScript、React Hook Form、Zod、Vitest、Testing Library、Vite

---

## 文件结构

- Create `src/features/tasks/CreateTaskDrawer.tsx`：右侧抽屉中的完整新建任务表单与创建流程。
- Create `src/features/tasks/CreateTaskDrawer.css`：新建抽屉表单、提醒区和窄抽屉内的单列布局。
- Create `src/features/tasks/CreateTaskDrawer.test.tsx`：验证抽屉容器、关闭动作和创建成功回调。
- Delete `src/features/tasks/CreateTaskModal.tsx`：移除旧弹窗实现。
- Delete `src/features/tasks/CreateTaskModal.css`：移除旧文件名，样式迁移到抽屉文件。
- Create `src/pages/taskCreationEntryPoints.test.ts`：锁定今日页使用抽屉、任务页无新建入口。
- Modify `src/pages/TodayPage.tsx`：接入 `CreateTaskDrawer`。
- Modify `src/pages/TasksPage.tsx`：移除新建任务相关入口、状态和组件。

### Task 1: 添加新建抽屉组件测试

**Files:**
- Create: `src/features/tasks/CreateTaskDrawer.test.tsx`
- Test: `src/features/tasks/CreateTaskDrawer.test.tsx`

- [ ] **Step 1: 写入失败测试**

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTask } from "../../services/tauri/tasks";
import { CreateTaskDrawer } from "./CreateTaskDrawer";

vi.mock("../../services/tauri/tasks", () => ({
  createTask: vi.fn(),
  mapTaskError: () => "创建失败",
}));

vi.mock("./ContactPicker", () => ({
  ContactPicker: () => <div data-testid="contact-picker" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CreateTaskDrawer", () => {
  it("renders the create form in a right-side drawer", () => {
    render(<CreateTaskDrawer open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "新建任务" })).toBeTruthy();
    expect(document.querySelector(".ws-drawer__panel")).toBeTruthy();
    expect(document.querySelector(".ws-modal__panel")).toBeNull();
  });

  it("closes from the drawer footer", () => {
    const onClose = vi.fn();
    render(<CreateTaskDrawer open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("notifies the page and closes after a successful creation", async () => {
    const created = {
      id: "task-1",
      title: "抽屉新任务",
      plannedAtMs: Date.now(),
      priority: 2,
      status: "not_started",
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    vi.mocked(createTask).mockResolvedValue(created);
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(
      <CreateTaskDrawer open onClose={onClose} onCreated={onCreated} />,
    );

    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "抽屉新任务" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 运行测试并确认失败**

运行：

```bash
npm test -- src/features/tasks/CreateTaskDrawer.test.tsx
```

预期：失败并提示无法找到 `./CreateTaskDrawer`。

- [ ] **Step 3: 提交失败测试**

```bash
git add src/features/tasks/CreateTaskDrawer.test.tsx
git commit -m "test: define create task drawer behavior"
```

### Task 2: 将新建表单迁移到 Drawer

**Files:**
- Create: `src/features/tasks/CreateTaskDrawer.tsx`
- Create: `src/features/tasks/CreateTaskDrawer.css`
- Delete: `src/features/tasks/CreateTaskModal.tsx`
- Delete: `src/features/tasks/CreateTaskModal.css`
- Test: `src/features/tasks/CreateTaskDrawer.test.tsx`

- [ ] **Step 1: 创建抽屉组件**

将 `CreateTaskModal.tsx` 的完整内容复制到 `CreateTaskDrawer.tsx`，然后应用以下精确替换；未列出的表单字段、校验和提交代码保持不变：

```diff
-import { Button, Input, Modal, Select, Textarea } from "../../shared/ui";
+import { Button, Drawer, Input, Select, Textarea } from "../../shared/ui";
-import "./CreateTaskModal.css";
+import "./CreateTaskDrawer.css";

-type CreateTaskModalProps = {
+type CreateTaskDrawerProps = {
   open: boolean;
   onClose: () => void;
   onCreated?: (task: Task) => void;
 };

-export function CreateTaskModal({ open, onClose, onCreated }: CreateTaskModalProps) {
+export function CreateTaskDrawer({ open, onClose, onCreated }: CreateTaskDrawerProps) {

-    <Modal
+    <Drawer
       open={open}
-      wide
       title="新建任务"
       onClose={onClose}
       footer={
         <>
           <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
             取消
           </Button>
           <Button type="submit" form="create-task-form" disabled={isSubmitting}>
             {isSubmitting ? "保存中…" : "创建任务"}
           </Button>
         </>
       }
     >

-    </Modal>
+    </Drawer>
```

- [ ] **Step 2: 迁移并收紧表单样式**

将 `CreateTaskModal.css` 的规则迁移到 `CreateTaskDrawer.css`，并把双列布局限定到足够宽的容器，确保 380px 抽屉内保持单列：

```css
.create-task-form {
  display: grid;
  gap: var(--space-2);
  color: var(--color-ink);
}

.create-task-form__row,
.create-task-form__reminder-item {
  display: grid;
  gap: var(--space-2);
}

.create-task-form__reminders {
  display: grid;
  gap: var(--space-2);
  padding: var(--space-2);
  border: 2px solid var(--color-anchor);
  border-radius: 3px;
  color: var(--color-anchor);
  background: var(--color-paper-raised);
  box-shadow: 4px 4px 0 var(--color-stage);
}
```

其余提醒标题、列表和错误样式从旧 CSS 原样迁移；删除会让抽屉内容过窄的 `@media (min-width: 560px)` 双列规则。

- [ ] **Step 3: 删除旧弹窗文件**

删除：

```text
src/features/tasks/CreateTaskModal.tsx
src/features/tasks/CreateTaskModal.css
```

- [ ] **Step 4: 运行组件测试并确认通过**

运行：

```bash
npm test -- src/features/tasks/CreateTaskDrawer.test.tsx
```

预期：3 项测试全部通过。

- [ ] **Step 5: 提交抽屉组件**

```bash
git add src/features/tasks/CreateTaskDrawer.tsx src/features/tasks/CreateTaskDrawer.css src/features/tasks/CreateTaskDrawer.test.tsx src/features/tasks/CreateTaskModal.tsx src/features/tasks/CreateTaskModal.css
git commit -m "feat: move task creation into drawer"
```

### Task 3: 更新页面入口边界

**Files:**
- Create: `src/pages/taskCreationEntryPoints.test.ts`
- Modify: `src/pages/TodayPage.tsx`
- Modify: `src/pages/TasksPage.tsx`
- Test: `src/pages/taskCreationEntryPoints.test.ts`

- [ ] **Step 1: 写入页面入口失败测试**

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const readSource = (path: string) =>
  readFileSync(join(process.cwd(), path), "utf8");

describe("task creation entry points", () => {
  const todayPage = readSource("src/pages/TodayPage.tsx");
  const tasksPage = readSource("src/pages/TasksPage.tsx");

  it("opens task creation from TodayPage with a drawer", () => {
    expect(todayPage).toContain('import { CreateTaskDrawer }');
    expect(todayPage).toContain("<CreateTaskDrawer");
    expect(todayPage).not.toContain("CreateTaskModal");
  });

  it("keeps TasksPage read-only with no creation entry", () => {
    expect(tasksPage).not.toContain("CreateTaskDrawer");
    expect(tasksPage).not.toContain("CreateTaskModal");
    expect(tasksPage).not.toContain("createOpen");
    expect(tasksPage).not.toContain(">新建任务</Button>");
  });
});
```

- [ ] **Step 2: 运行页面入口测试并确认失败**

运行：

```bash
npm test -- src/pages/taskCreationEntryPoints.test.ts
```

预期：今日页仍引用 `CreateTaskModal`，任务页仍包含新建入口，因此测试失败。

- [ ] **Step 3: 更新 TodayPage**

将导入和渲染替换为：

```tsx
import { CreateTaskDrawer } from "../features/tasks/CreateTaskDrawer";

<CreateTaskDrawer
  open={createOpen}
  onClose={() => setCreateOpen(false)}
  onCreated={() => void loadTodayTasks()}
/>
```

- [ ] **Step 4: 清理 TasksPage**

删除下面四类代码：

```tsx
import { CreateTaskModal } from "../features/tasks/CreateTaskModal";
const [createOpen, setCreateOpen] = useState(false);
<Button onClick={() => setCreateOpen(true)}>新建任务</Button>
<CreateTaskModal open={createOpen} onClose={...} onCreated={...} />
```

保留 `Button` 导入，因为列表错误重试、视图切换仍在使用。

- [ ] **Step 5: 运行页面和组件测试**

运行：

```bash
npm test -- src/pages/taskCreationEntryPoints.test.ts src/features/tasks/CreateTaskDrawer.test.tsx
```

预期：5 项测试全部通过。

- [ ] **Step 6: 提交页面接入**

```bash
git add src/pages/TodayPage.tsx src/pages/TasksPage.tsx src/pages/taskCreationEntryPoints.test.ts
git commit -m "refactor: limit task creation to today drawer"
```

### Task 4: 完整验证

**Files:**
- Verify: `src/features/tasks/CreateTaskDrawer.tsx`
- Verify: `src/pages/TodayPage.tsx`
- Verify: `src/pages/TasksPage.tsx`

- [ ] **Step 1: 运行全部测试**

```bash
npm test
```

预期：全部前端测试通过。

- [ ] **Step 2: 运行生产构建**

```bash
npm run build
```

预期：TypeScript 检查和 Vite 构建成功。

- [ ] **Step 3: 检查运行中的 App**

确认“今日”页点击“+ 新任务”后右侧抽屉展开，取消可关闭；确认“任务”页不再显示“新建任务”按钮。创建成功时抽屉自动关闭且今日列表刷新。
