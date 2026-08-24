# Task Time Range Auto Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将新建任务改为分钟级时间段和自由输入对接人，并用三档进度型系统提醒及“反骨工票”弹窗替代新建表单中的自定义提醒。

**Architecture:** 前端继续把开始/完成时间映射到现有 `plannedAtMs/deadlineAtMs`，避免数据库迁移。Rust 系统提醒节点改为依赖开始与完成时间的纯计算，提醒引擎对同一任务的过期节点批量标记、只呈现最紧急的一次；提醒窗口继续复用现有 Tauri 展示链路，仅替换提醒种类、文案和视觉。

**Tech Stack:** React 19、TypeScript、React Hook Form、Zod、Vitest、Rust、rusqlite、Tauri、CSS

---

## 文件结构

- Modify `src/features/tasks/createTaskForm.ts`：分钟级默认时间段、必填完成时间、自由文本对接人和请求映射。
- Modify `src/features/tasks/createTaskForm.test.ts`：覆盖 18:00 默认值、次日顺延、时间校验和联系人映射。
- Modify `src/features/tasks/CreateTaskDrawer.tsx`：移除联系人管理器与自定义提醒，渲染时间段和自由输入。
- Modify `src/features/tasks/CreateTaskDrawer.test.tsx`：锁定新表单交互。
- Modify `src/features/tasks/CreateTaskDrawer.css`：时间段票据区样式并删除提醒区样式。
- Modify `src-tauri/src/db/repositories/system_reminder_repository.rs`：新提醒枚举、进度节点计算和实际计划时间持久化。
- Modify `src-tauri/src/services/system_reminder.rs`：新的节点与标记接口。
- Modify `src-tauri/src/services/reminder_engine.rs`：活跃任务补发合并、批量处理过期节点。
- Modify `src-tauri/src/services/reminder_notifier.rs`：系统通知文案。
- Modify `src-tauri/src/services/reminder_window.rs`：新提醒紧急度排序。
- Modify `src/config/copy.ts`、`src/features/reminder/reminderWindowCopy.ts`：三档班味文案。
- Modify `src/assets/mascot/index.ts`：新提醒种类到现有吉祥物与动画的映射。
- Modify `src/features/reminder/ReminderWindowView.tsx`、`ReminderWindowView.css`：A“反骨工票”结构与桌面视觉。
- Modify co-located tests in `system_reminder_repository.rs`, `system_reminder.rs`, `reminder_engine.rs`, `reminder_notifier.rs`, `reminder_window.rs` and `reminder_attention.rs` to replace old DDL reminder expectations.

### Task 1: 新建任务时间段与自由输入对接人

**Files:**
- Modify: `src/features/tasks/createTaskForm.ts`
- Modify: `src/features/tasks/createTaskForm.test.ts`
- Modify: `src/features/tasks/CreateTaskDrawer.tsx`
- Modify: `src/features/tasks/CreateTaskDrawer.test.tsx`
- Modify: `src/features/tasks/CreateTaskDrawer.css`

- [ ] **Step 1: 写入表单模型失败测试**

新增测试，使用固定系统时间验证：

```ts
vi.useFakeTimers();
vi.setSystemTime(new Date(2026, 7, 24, 9, 17, 43));
expect(createDefaultFormValues()).toMatchObject({
  startAt: "2026-08-24T09:17",
  endAt: "2026-08-24T18:00",
  priority: 2,
  contactName: "",
});

vi.setSystemTime(new Date(2026, 7, 24, 18, 1));
expect(createDefaultFormValues().endAt).toBe("2026-08-25T18:00");
```

新增转换断言：

```ts
expect(toCreateTaskInput({
  title: "交方案",
  note: "",
  startAt: "2026-08-24T09:00",
  endAt: "2026-08-24T18:00",
  priority: 2,
  contactName: " 小王 ",
})).toMatchObject({
  plannedAtMs: new Date("2026-08-24T09:00").getTime(),
  deadlineAtMs: new Date("2026-08-24T18:00").getTime(),
  priority: 2,
  contactSnapshot: "小王",
});
```

- [ ] **Step 2: 运行表单测试并确认失败**

```bash
npm test -- src/features/tasks/createTaskForm.test.ts
```

预期：旧模型仍使用 `plannedAt/deadlineAt/contactId/reminders`，新增断言失败。

- [ ] **Step 3: 实现新表单模型**

将表单值改为：

```ts
const createTaskFormSchema = z.object({
  title: z.string().trim().min(1, "任务名称必填"),
  note: z.string().max(2000, "备注最多 2000 字").optional(),
  startAt: z.string().min(1, "请选择开始时间"),
  endAt: z.string().min(1, "请选择完成时间"),
  priority: z.number().int().min(1).max(5),
  contactName: z.string().max(100, "对接人最多 100 字").optional(),
}).superRefine((values, context) => {
  if (datetimeLocalToMs(values.endAt) <= datetimeLocalToMs(values.startAt)) {
    context.addIssue({
      code: "custom",
      message: "完成时间必须晚于开始时间",
      path: ["endAt"],
    });
  }
});
```

默认值使用当前分钟和当天/次日 18:00，`toCreateTaskInput` 固定提交必填 `deadlineAtMs`、优先级和可选 `contactSnapshot`，不再提交 `reminders`。

- [ ] **Step 4: 更新抽屉字段**

删除 `Controller/useFieldArray/ContactPicker` 及整个自定义提醒区，加入：

```tsx
<section className="create-task-form__time-range" aria-labelledby="create-task-time-range">
  <h3 id="create-task-time-range">任务时间段</h3>
  <Input label="开始时间" type="datetime-local" step={60} error={errors.startAt?.message} {...register("startAt")} />
  <Input label="完成时间" type="datetime-local" step={60} error={errors.endAt?.message} {...register("endAt")} />
</section>

<Input
  label="对接人"
  placeholder="可选，输入姓名"
  error={errors.contactName?.message}
  {...register("contactName")}
/>
```

- [ ] **Step 5: 更新抽屉测试并确认通过**

断言默认“正常”选项被选中、两个时间输入 `step="60"`、存在自由输入对接人且不存在“自定义提醒”。

```bash
npm test -- src/features/tasks/createTaskForm.test.ts src/features/tasks/CreateTaskDrawer.test.tsx
```

预期：全部通过。

- [ ] **Step 6: 提交前端表单改造**

```bash
git add src/features/tasks/createTaskForm.ts src/features/tasks/createTaskForm.test.ts src/features/tasks/CreateTaskDrawer.tsx src/features/tasks/CreateTaskDrawer.test.tsx src/features/tasks/CreateTaskDrawer.css
git commit -m "feat: create tasks with required time range"
```

### Task 2: 进度型系统提醒节点

**Files:**
- Modify: `src-tauri/src/db/repositories/system_reminder_repository.rs`
- Modify: `src-tauri/src/services/system_reminder.rs`

- [ ] **Step 1: 写入节点计算失败测试**

为 `compute_nodes(planned_at_ms, deadline_at_ms)` 增加：

```rust
#[test]
fn computes_progress_nodes_in_time_order() {
    let nodes = compute_nodes(0, 8 * 60 * 60 * 1000).expect("nodes");
    assert_eq!(nodes.iter().map(|node| node.kind).collect::<Vec<_>>(), vec![
        SystemReminderKind::ProgressHalf,
        SystemReminderKind::QuarterRemaining,
        SystemReminderKind::OneHourRemaining,
    ]);
    assert_eq!(nodes.iter().map(|node| node.trigger_at_ms).collect::<Vec<_>>(), vec![
        4 * 60 * 60 * 1000,
        6 * 60 * 60 * 1000,
        7 * 60 * 60 * 1000,
    ]);
}

#[test]
fn merges_same_minute_and_skips_nodes_outside_range() {
    let nodes = compute_nodes(60_000, 121 * 60_000).expect("nodes");
    assert_eq!(nodes.len(), 2);
    assert_eq!(nodes[0].kind, SystemReminderKind::ProgressHalf);
    assert_eq!(nodes[1].kind, SystemReminderKind::OneHourRemaining);
}
```

- [ ] **Step 2: 运行 Rust 聚焦测试并确认失败**

```bash
cargo test system_reminder_repository --manifest-path src-tauri/Cargo.toml
```

预期：旧 API 只接收 deadline，旧枚举仍为 DDL 节点，测试失败。

- [ ] **Step 3: 实现新枚举和计算函数**

使用：

```rust
pub enum SystemReminderKind {
    ProgressHalf,
    QuarterRemaining,
    OneHourRemaining,
}

pub fn compute_nodes(planned_at_ms: i64, deadline_at_ms: i64) -> Result<Vec<SystemReminderNode>, SystemReminderRepositoryError>
```

计算 50%、75% 和 `E - 1h`，向下取整到 `60_000ms`；过滤范围外节点，按时间排序，并对同一分钟按 `OneHourRemaining > QuarterRemaining > ProgressHalf` 去重。

- [ ] **Step 4: 让日志保存实际计划时间**

把 `MarkSystemReminderFiredInput` 增加 `scheduled_at_ms`，`mark_fired` 使用该值写入数据库，不再通过固定 DDL 偏移反推：

```rust
pub struct MarkSystemReminderFiredInput {
    pub id: String,
    pub task_id: String,
    pub kind: SystemReminderKind,
    pub deadline_snapshot_ms: i64,
    pub scheduled_at_ms: i64,
    pub fired_at_ms: i64,
}
```

- [ ] **Step 5: 更新服务接口并运行测试**

`SystemReminderService::compute_nodes` 接收开始与完成时间；`mark_fired` 接收节点计划时间。运行：

```bash
cargo test system_reminder --manifest-path src-tauri/Cargo.toml
```

预期：节点、日志、延期快照和自定义提醒隔离测试通过。

- [ ] **Step 6: 提交提醒节点改造**

```bash
git add src-tauri/src/db/repositories/system_reminder_repository.rs src-tauri/src/services/system_reminder.rs
git commit -m "feat: compute progress based system reminders"
```

### Task 3: 提醒引擎补发与合并

**Files:**
- Modify: `src-tauri/src/services/reminder_engine.rs`
- Modify: `src-tauri/src/services/reminder_notifier.rs`
- Modify: `src-tauri/src/services/reminder_window.rs`
- Modify: `src-tauri/src/services/reminder_attention.rs`

- [ ] **Step 1: 写入引擎失败测试**

新增测试创建仍在时间段内的任务，在一次 tick 中错过两个节点：

```rust
let result = ReminderEngineService::tick(&db.connection, now_ms, cutoff_ms).expect("tick");
let system = result.triggered.iter().filter_map(|payload| match payload {
    ReminderTriggeredPayload::System { reminder_kind, .. } => Some(reminder_kind.as_str()),
    _ => None,
}).collect::<Vec<_>>();
assert_eq!(system, vec!["quarter_remaining"]);
assert!(SystemReminderRepository::has_fired(&db.connection, &task.id, SystemReminderKind::ProgressHalf, deadline).unwrap());
assert!(SystemReminderRepository::has_fired(&db.connection, &task.id, SystemReminderKind::QuarterRemaining, deadline).unwrap());
```

增加 `now >= deadline` 不补发、延期使用新快照、已有自定义提醒仍触发的测试。

- [ ] **Step 2: 运行引擎测试并确认失败**

```bash
cargo test reminder_engine --manifest-path src-tauri/Cargo.toml
```

预期：旧引擎逐条发出 DDL 节点，测试失败。

- [ ] **Step 3: 实现每任务只呈现最紧急节点**

系统任务循环改为：

```rust
if now_ms <= task.planned_at_ms || now_ms >= deadline_snapshot_ms {
    continue;
}
let mut due = Vec::new();
for node in compute_nodes(task.planned_at_ms, deadline_snapshot_ms)
    .map_err(map_system_reminder_error)?
{
    if node.trigger_at_ms > now_ms {
        continue;
    }
    if SystemReminderRepository::has_fired(
        connection,
        &task.id,
        node.kind,
        deadline_snapshot_ms,
    )
    .map_err(map_system_reminder_error)?
    {
        continue;
    }
    due.push(node);
}
```

将所有 `due` 节点写入 fired 日志，只把按计划时间及紧急度排序后的最后一个节点加入 `triggered`。系统节点不再使用启动 cutoff 过滤；自定义提醒继续保留 cutoff 行为。

- [ ] **Step 4: 更新通知和窗口紧急度**

系统通知文案：

```rust
"progress_half" => format!("「{task_title}」工期已经烧掉一半"),
"quarter_remaining" => format!("「{task_title}」只剩四分之一"),
"one_hour_remaining" => format!("「{task_title}」最后一小时"),
```

窗口紧急度顺序：`one_hour_remaining=90`、`quarter_remaining=80`、`progress_half=60`，custom 保持现有等级。

- [ ] **Step 5: 更新受影响 Rust 测试并运行服务测试**

```bash
cargo test reminder_ --manifest-path src-tauri/Cargo.toml
```

预期：引擎、系统通知、提醒窗口和窗口注意力测试全部通过。

- [ ] **Step 6: 提交引擎改造**

```bash
git add src-tauri/src/services/reminder_engine.rs src-tauri/src/services/reminder_notifier.rs src-tauri/src/services/reminder_window.rs src-tauri/src/services/reminder_attention.rs
git commit -m "feat: collapse missed progress reminders"
```

### Task 4: 反骨工票文案、吉祥物与结构

**Files:**
- Modify: `src/config/copy.ts`
- Modify: `src/features/reminder/reminderWindowCopy.ts`
- Modify: `src/features/reminder/reminderWindowCopy.test.ts`
- Modify: `src/assets/mascot/index.ts`
- Modify: `src/assets/mascot/mascotContract.test.ts`
- Modify: `src/features/reminder/ReminderWindowView.tsx`
- Modify: `src/features/reminder/ReminderWindowView.test.tsx`

- [ ] **Step 1: 写入新提醒文案与结构失败测试**

断言三档 headline：

```ts
expect(reminderHeadline(systemPayload("progress_half"))).toBe("工期已烧掉一半，你的进度还在加载企业文化。");
expect(reminderHeadline(systemPayload("quarter_remaining"))).toBe("只剩四分之一。建议停止同步上下文，上下文已经开始同步你的死线。");
expect(reminderHeadline(systemPayload("one_hour_remaining"))).toBe("最后一小时。现在开始努力，至少能显得之前不是纯摸鱼。");
```

组件测试断言按钮名称为“我知道了，别催”和“去把坑填上 →”，根节点带对应 `data-reminder-kind`。

- [ ] **Step 2: 运行前端提醒测试并确认失败**

```bash
npm test -- src/features/reminder/reminderWindowCopy.test.ts src/features/reminder/ReminderWindowView.test.tsx src/assets/mascot/mascotContract.test.ts
```

预期：旧 copy、旧按钮与旧吉祥物映射导致失败。

- [ ] **Step 3: 更新 copy 与吉祥物映射**

映射：`progress_half → ddl-calm/breathe`，`quarter_remaining → ddl-anxious/shake`，`one_hour_remaining → ddl-panic/panic`。自定义提醒映射保持不变。

- [ ] **Step 4: 更新反骨工票 JSX**

`ReminderWindowView` 增加阶段大字：50%、1/4、01:00；印章：醒、急、冲。按钮改为：

```tsx
<Button variant="secondary" onClick={onDismiss}>我知道了，别催</Button>
<Button variant="wheat" onClick={openTask}>去把坑填上 →</Button>
```

保留任务标题、额外任务数量和打开失败关闭的现有逻辑。

- [ ] **Step 5: 运行前端提醒测试并确认通过**

```bash
npm test -- src/features/reminder/reminderWindowCopy.test.ts src/features/reminder/ReminderWindowView.test.tsx src/assets/mascot/mascotContract.test.ts
```

预期：全部通过。

- [ ] **Step 6: 提交文案与结构**

```bash
git add src/config/copy.ts src/features/reminder/reminderWindowCopy.ts src/features/reminder/reminderWindowCopy.test.ts src/assets/mascot/index.ts src/assets/mascot/mascotContract.test.ts src/features/reminder/ReminderWindowView.tsx src/features/reminder/ReminderWindowView.test.tsx
git commit -m "feat: add rebellious work ticket reminders"
```

### Task 5: 反骨工票桌面视觉

**Files:**
- Modify: `src/features/reminder/ReminderWindowView.css`

- [ ] **Step 1: 实现三档桌面视觉状态**

使用现有语义色，按 `data-reminder-kind` 设置：

```css
.reminder-window__card[data-reminder-kind="progress_half"] { --ticket-stage: var(--color-reaction); --ticket-accent: var(--color-stage); }
.reminder-window__card[data-reminder-kind="quarter_remaining"] { --ticket-stage: var(--color-reaction); --ticket-accent: var(--color-danger); }
.reminder-window__card[data-reminder-kind="one_hour_remaining"] { --ticket-stage: var(--color-danger); --ticket-accent: var(--color-signal); }
```

票据栏、超大数字、倾斜印章、硬阴影和底部按钮区均使用 `--ticket-stage/--ticket-accent`；不添加手机端断点。

- [ ] **Step 2: 增加减少动态效果规则**

```css
@media (prefers-reduced-motion: reduce) {
  .reminder-window__card,
  .reminder-window__stamp,
  .reminder-window__mascot { animation: none; transform: none; }
}
```

- [ ] **Step 3: 运行提醒测试和构建**

```bash
npm test -- src/features/reminder/ReminderWindowView.test.tsx src/styles/colorSystem.test.ts
npm run build
```

预期：测试和构建通过。

- [ ] **Step 4: 提交视觉实现**

```bash
git add src/features/reminder/ReminderWindowView.css
git commit -m "style: redesign reminders as work alert tickets"
```

### Task 6: 完整回归与桌面验收

**Files:**
- Verify all modified frontend and Rust files.

- [ ] **Step 1: 运行全部前端测试**

```bash
npm test
```

预期：全部通过。

- [ ] **Step 2: 运行全部 Rust 测试**

```bash
cargo test --manifest-path src-tauri/Cargo.toml
```

预期：全部通过。

- [ ] **Step 3: 运行生产构建**

```bash
npm run build
```

预期：TypeScript 检查与 Vite 构建成功。

- [ ] **Step 4: 重启并验收桌面 App**

确认新建抽屉默认结束时间、分钟精度、自由输入对接人、无自定义提醒；确认三档节点计算和 A“反骨工票”结构。保持开发版 App 运行供用户检查。
