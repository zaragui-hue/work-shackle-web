# Work Shackle 项目目录规范

> 目录目标：让 Cursor 一次只理解一个模块，减少跨目录修改和上下文浪费。

```text
work-shackle/
│
├── .cursor/
│   └── rules/
│       ├── 00-project-core.mdc
│       ├── 10-frontend.mdc
│       ├── 20-tauri-rust.mdc
│       ├── 30-data-and-time.mdc
│       ├── 40-ui-visual.mdc
│       └── 50-testing-and-task-scope.mdc
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md
│   ├── PROJECT_STRUCTURE.md
│   ├── DEVELOPMENT_PLAN.md
│   └── CURSOR_WORKFLOW.md
│
├── tasks/
│   ├── TASK_TEMPLATE.md
│   └── ...
│
├── public/
│
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   ├── AppShell.tsx
│   │   └── navigation.ts
│   │
│   ├── features/
│   │   ├── today/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── TodayView.tsx
│   │   │   └── today.types.ts
│   │   │
│   │   ├── tasks/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   ├── TaskListView.tsx
│   │   │   ├── TaskDrawer.tsx
│   │   │   └── task.types.ts
│   │   │
│   │   ├── calendar/
│   │   │   ├── components/
│   │   │   ├── CalendarView.tsx
│   │   │   └── calendar.types.ts
│   │   │
│   │   ├── work-status/
│   │   │   ├── components/
│   │   │   └── work-status.types.ts
│   │   │
│   │   ├── overtime/
│   │   │   ├── components/
│   │   │   └── overtime.types.ts
│   │   │
│   │   ├── reminders/
│   │   │   ├── components/
│   │   │   └── reminder.types.ts
│   │   │
│   │   └── settings/
│   │       ├── components/
│   │       ├── SettingsView.tsx
│   │       └── settings.types.ts
│   │
│   ├── services/
│   │   └── tauri/
│   │       ├── workspace.ts
│   │       ├── tasks.ts
│   │       ├── contacts.ts
│   │       ├── reminders.ts
│   │       ├── workStatus.ts
│   │       ├── overtime.ts
│   │       └── settings.ts
│   │
│   ├── shared/
│   │   ├── components/
│   │   │   ├── Button/
│   │   │   ├── Card/
│   │   │   ├── Drawer/
│   │   │   ├── Modal/
│   │   │   ├── EmptyState/
│   │   │   └── Mascot/
│   │   ├── lib/
│   │   │   ├── date.ts
│   │   │   └── format.ts
│   │   └── types/
│   │       └── ipc.ts
│   │
│   ├── assets/
│   │   ├── mascot/
│   │   ├── textures/
│   │   └── icons/
│   │
│   └── styles/
│       ├── tokens.css
│       ├── global.css
│       └── animations.css
│
├── src-tauri/
│   ├── capabilities/
│   │   └── default.json
│   │
│   ├── icons/
│   │
│   ├── migrations/
│   │   └── 0001_init.sql
│   │
│   ├── src/
│   │   ├── lib.rs
│   │   ├── main.rs
│   │   ├── app_state.rs
│   │   │
│   │   ├── commands/
│   │   │   ├── mod.rs
│   │   │   ├── workspace.rs
│   │   │   ├── tasks.rs
│   │   │   ├── contacts.rs
│   │   │   ├── reminders.rs
│   │   │   ├── work_status.rs
│   │   │   ├── overtime.rs
│   │   │   └── settings.rs
│   │   │
│   │   ├── db/
│   │   │   ├── mod.rs
│   │   │   ├── connection.rs
│   │   │   ├── migrations.rs
│   │   │   └── repositories/
│   │   │       ├── tasks.rs
│   │   │       ├── contacts.rs
│   │   │       ├── reminders.rs
│   │   │       ├── work_status.rs
│   │   │       ├── overtime.rs
│   │   │       └── settings.rs
│   │   │
│   │   ├── services/
│   │   │   ├── mod.rs
│   │   │   ├── workspace.rs
│   │   │   ├── workspace_validator.rs
│   │   │   ├── task_service.rs
│   │   │   ├── reminder_engine.rs
│   │   │   ├── work_status_service.rs
│   │   │   ├── overtime_service.rs
│   │   │   └── busy_level_service.rs
│   │   │
│   │   ├── time/
│   │   │   ├── mod.rs
│   │   │   ├── instant.rs
│   │   │   ├── work_day.rs
│   │   │   ├── ddl.rs
│   │   │   └── week_folder.rs
│   │   │
│   │   ├── models/
│   │   │   ├── mod.rs
│   │   │   ├── task.rs
│   │   │   ├── contact.rs
│   │   │   ├── reminder.rs
│   │   │   ├── work_status.rs
│   │   │   └── overtime.rs
│   │   │
│   │   └── errors/
│   │       ├── mod.rs
│   │       └── app_error.rs
│   │
│   ├── Cargo.toml
│   └── tauri.conf.json
│
├── .cursorignore
├── .gitignore
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

# 目录职责规则

## `src/features`

按业务功能拆分。

Cursor 实现某个产品能力时，优先只修改对应 feature。

例如：

```text
TASK: 实现月历
```

主要上下文：

```text
src/features/calendar/**
src/services/tauri/tasks.ts
docs/PRD.md 对应日历章节
```

不需要读取整个 `today/` 或 `settings/`。

## `src/services/tauri`

前端唯一 IPC 入口。

React 组件禁止直接：

```ts
invoke("create_task", ...)
```

必须：

```ts
taskService.create(...)
```

好处：

- Rust command 名称只集中维护一次；
- 前端组件更容易测试；
- Cursor 修改 IPC 时不需要全项目搜索。

## `src/shared/components`

只放至少被两个 feature 使用的组件。

不要提前建设几十个“未来可能用到”的组件。

规则：

> 第一次使用先放 feature 内；第二个 feature 也需要时再抽 shared。

## `src-tauri/src/commands`

只做 IPC 边界：

```text
解析参数
↓
调用 service
↓
映射返回值 / 错误
```

不在 command 文件堆复杂业务逻辑。

## `src-tauri/src/services`

真正业务规则。

例如：

- 延期；
- DDL；
- reminder；
- overtime；
- busy level。

`workspace_validator.rs` 集中实现工作目录最终校验：

- 只接受可靠的本机文件系统；
- Windows 拒绝 UNC / 网络路径；
- macOS 不支持网络挂载和移动挂载目录；
- 对明确识别出的云同步目录返回重新选择提示；
- 默认目录与用户自定义目录共用同一校验器。

React 只展示校验结果，不复制平台路径判断。

## `src-tauri/src/db/repositories`

只负责 SQL。

Repository 不负责决定：

> “这个任务是否应该提醒。”

它只负责读写。

## `src-tauri/src/time`

所有时间算法唯一位置。

职责包括：

- `instant.rs`：Unix epoch milliseconds 与当地时间转换；
- `work_day.rs`：当地时间 05:00 WorkDay Cutoff，以及加班/工作状态的 `work_date` 归属；
- `ddl.rs`：DDL 进度、提醒节点和普通日历日期；
- `week_folder.rs`：周一至周日及跨月周目录。

绝对时间存 SQLite `INTEGER` epoch milliseconds，业务日期使用 `YYYY-MM-DD`，每日钟表时间使用 `HH:MM`。

禁止前后端各写一套跨月周 / 05:00 / DDL 算法。任务 planned date 和 DDL 日历日期不得套用 05:00 WorkDay Cutoff。

---

# 文件大小建议

这是 Cursor Vibe Coding 的约束，不是绝对语言规范：

- React component：尽量 < 250 行；
- Rust service：尽量 < 300 行；
- 单个 rule：尽量 < 200 行；
- 单个 TASK：原则上控制在 3–6 个核心文件；
- 超过范围时先拆任务。

不要为了满足行数机械拆出无意义文件。
