# Work Shackle V1 技术架构

> 基于 `docs/PRD.md` 的冻结版工程设计。  
> 目标：本地优先、跨 macOS/Windows、可点击安装、低依赖、适合单人 Cursor Vibe Coding。

---

## 1. 技术选型结论

### 1.1 桌面框架

**Tauri 2.x**

理由：

- 原生支持 macOS / Windows 桌面打包；
- 支持系统通知、窗口控制、文件选择等桌面能力；
- 前端仍可使用 React + TypeScript；
- V1 是纯本地工具，没有必要引入 Node 常驻服务端；
- Rust 只承担“本地能力 + 数据 + 计时/提醒引擎”，前端仍以 TypeScript 为主。

### 1.2 前端

- React
- TypeScript
- Vite
- CSS Modules + CSS Custom Properties
- date-fns
- React Hook Form + Zod
- lucide-react 仅用于功能型小图标

**V1 不引入：**

- Next.js
- Redux
- 大型 UI 框架
- FullCalendar
- Tailwind/shadcn 作为主视觉体系
- Framer Motion 作为必选依赖
- 在线字体、在线图标、CDN 素材

原因：Work Shackle 需要强定制的国潮治愈卡通视觉，且 V1 页面数量不多。过多框架会增加样式覆盖、上下文和维护成本。

### 1.3 Rust / Tauri 后端

- Rust stable
- Tauri 2.x
- `rusqlite`：SQLite 数据访问
- `serde` / `serde_json`
- `chrono`：Rust 侧时间处理
- Tauri Notification Plugin
- Tauri Dialog Plugin
- Tauri Single Instance Plugin

### 1.4 数据库

**SQLite，数据库文件位于用户工作目录：**

```text
<workspace>/.data/work-shackle.db
```

不使用 Tauri SQL Plugin 作为核心数据库访问层。

原因：

Tauri SQL Plugin 的 SQLite 路径默认相对于 AppConfig 目录；而冻结版 PRD 明确要求数据库和业务数据跟随用户工作目录。为避免把业务数据偷偷留在系统 AppData 中，V1 使用 Rust `rusqlite` 直接打开用户指定路径。

### 1.5 包管理

前端统一使用：

```text
npm
```

理由：减少环境依赖，不要求用户额外安装 pnpm/yarn。

---

# 2. 总体架构

```text
┌──────────────────────────────────────┐
│ React + TypeScript UI                │
│ Today / Tasks / Calendar / Settings  │
└─────────────────┬────────────────────┘
                  │ Tauri invoke / event
┌─────────────────▼────────────────────┐
│ TypeScript Bridge                    │
│ src/services/tauri/*                 │
│ 统一封装 invoke，不允许组件直调 Rust   │
└─────────────────┬────────────────────┘
                  │ IPC
┌─────────────────▼────────────────────┐
│ Tauri / Rust Application Layer       │
│                                      │
│ WorkspaceService                     │
│ TaskService                          │
│ ReminderEngine                       │
│ WorkStatusService                    │
│ OvertimeService                      │
│ SettingsService                      │
└──────────────┬───────────┬───────────┘
               │           │
       ┌───────▼──────┐ ┌──▼─────────────────┐
       │ SQLite       │ │ OS Integration      │
       │ rusqlite     │ │ Notification        │
       │ migrations   │ │ Dialog              │
       │              │ │ Window Attention    │
       └──────────────┘ │ File System         │
                        └─────────────────────┘
```

---

# 3. 前后端职责边界

## 3.1 React 前端负责

- 页面展示；
- 表单输入；
- 筛选条件；
- Drawer / Modal；
- 任务卡片；
- 日历网格；
- 角色 SVG/WebP 展示；
- CSS 微动效；
- 当前倒计时的视觉刷新；
- 调用统一的 Tauri Bridge；
- 接收 Rust 发出的提醒事件。

前端**不直接负责**：

- SQLite SQL；
- 工作目录真实文件操作；
- DDL 是否应该触发提醒的最终判断；
- 05:00 自动结束加班的最终判断；
- 数据迁移；
- 工作目录有效性。

## 3.2 Rust 后端负责

- 工作目录初始化和校验；
- SQLite 打开、迁移和事务；
- CRUD；
- 日期/DDL/逾期业务规则；
- 提醒调度；
- 系统通知；
- Dock / Taskbar 请求用户注意；
- 加班状态修正；
- 05:00 自动结束；
- 年/月/周目录创建；
- 跨平台文件路径；
- 单实例保护。

---

# 4. 为什么采用“Rust 管业务事实，React 管展示”

Work Shackle 有多个必须在 App 最小化、休眠恢复或重新启动后仍然正确的规则：

- DDL 60/30/10 分钟提醒；
- DDL 到点；
- 已完成任务停止提醒；
- 加班次日 05:00 自动结束；
- App 退出后重新打开要补记 05:00；
- 工作目录可能被用户手动删除；
- 同一天任务日历去重。

这些规则如果全部散落在 React `setTimeout` / `setInterval` 中，容易因窗口重载、WebView 节流或重启而失真。

因此：

> Rust 保存“事实和规则”，React 只表现事实。

---

# 5. 工作目录架构

## 5.1 系统配置区只保存一个最小配置

操作系统 App 配置目录只允许保存：

```json
{
  "workspacePath": "/user/selected/path"
}
```

不得保存：

- 任务；
- DDL；
- 联系人；
- 加班；
- 工作状态；
- 忙碌配置。

业务数据必须在用户工作目录。

## 5.2 工作目录内部

```text
<workspace>/
├── .data/
│   └── work-shackle.db
└── YYYY/
    └── MM/
        └── 第WW周_MM.DD-MM.DD/
```

## 5.3 默认工作目录

macOS：

```text
~/Documents/Work Shackle
```

Windows：

```text
D:\Work Shackle
```

若 D 盘不存在或不可写：

```text
%USERPROFILE%\Documents\Work Shackle
```

## 5.4 WorkspaceValidator

SQLite 数据库必须位于可靠的本机文件系统。用户可以自定义工作目录，但候选目录必须先通过 Rust `WorkspaceValidator` 校验，前端只能展示校验结果，不得自行形成另一套最终判断。

V1 约束：

- 不支持网络文件系统作为工作目录；
- Windows UNC / 网络路径必须拒绝；
- macOS 网络挂载目录和移动挂载目录不作为支持的数据目录；
- 对能够明确识别出的云同步目录，提示用户重新选择本地目录；
- 校验至少覆盖：路径类型、目录存在性或可创建性、读写能力，以及用于 SQLite 的本地持久存储条件；
- 默认目录与用户自定义目录使用同一套校验；
- 校验失败时不得创建或打开业务数据库，也不得把该路径写入 `workspacePath`。

`WorkspaceValidator` 只负责判断目录能否作为 Work Shackle 工作目录，不在前端暴露平台文件系统判断细节。

## 5.5 启动流程

```text
App 启动
↓
读取 workspacePath
↓
是否存在已配置路径？
├─ 是 → WorkspaceValidator 校验
└─ 否 → 计算默认目录
↓
WorkspaceValidator 校验最终候选目录
↓
确保 .data 存在
↓
打开 SQLite
↓
执行数据库迁移
↓
确保当前 年/月/周 目录存在
↓
执行 startup reconciliation
↓
启动 ReminderEngine
↓
通知前端“ready”
```

任何候选目录未通过 `WorkspaceValidator` 时，启动流程停留在 workspace 不可用状态，不得继续打开 SQLite。

## 5.6 工作目录切换的安全策略

为避免“换目录后像数据丢了”，技术实现采用：

```text
用户选择新目录
↓
WorkspaceValidator 校验目标目录
↓
停止写入 + 关闭当前 DB
↓
复制当前工作目录数据到目标目录
↓
打开目标 DB 并校验 schema / 基础查询
↓
校验成功后更新 workspacePath
↓
切换到新目录
```

**旧目录不自动删除。**

原因：V1 没有备份能力，自动删除旧目录风险过高。成功切换后可提示用户旧目录仍保留，可自行删除。

如果复制/校验失败：

- 保持原工作目录；
- 不修改 `workspacePath`；
- 明确显示失败原因。

---

# 6. SQLite 设计原则

## 6.1 连接

使用 Rust `rusqlite` 管理。

建议：

- 单应用单实例；
- 一个受 Mutex 管理的主连接；
- 所有写操作使用 transaction；
- `PRAGMA foreign_keys = ON`；
- 设置合理 `busy_timeout`。

## 6.2 Journal Mode

V1 不主动开启 WAL。

原因：

- App 是单用户、单实例，本身没有强并发写入需求；
- 工作目录虽由用户选择，但必须先通过 `WorkspaceValidator`；
- V1 不支持网络文件系统，且不依赖 WAL 获得并发能力；
- 默认 rollback journal 对 V1 更简单、更保守。

## 6.3 数据迁移

目录：

```text
src-tauri/migrations/
```

例如：

```text
0001_init.sql
0002_add_xxx.sql
```

原则：

- 永远新增 migration；
- 已发布 migration 不回头修改；
- migration 必须在 transaction 中执行；
- 使用 `schema_migrations` 记录已执行版本；
- migration 失败必须 rollback；
- Cursor 不得“为了方便”直接删除旧库重新建库。

---

# 7. V1 表设计

## 7.1 tasks

核心字段：

```text
id TEXT PRIMARY KEY
title TEXT NOT NULL
note TEXT
planned_at_ms INTEGER NOT NULL
deadline_at_ms INTEGER
priority INTEGER NOT NULL DEFAULT 2
status TEXT NOT NULL
contact_id TEXT
contact_snapshot TEXT
created_at_ms INTEGER NOT NULL
completed_at_ms INTEGER
cancelled_at_ms INTEGER
updated_at_ms INTEGER NOT NULL
```

以上 `*_at_ms` 字段均为 Unix epoch milliseconds。

## 7.2 contacts

```text
id
name
is_active
created_at_ms INTEGER
updated_at_ms INTEGER
```

联系人从列表移除：

```text
is_active = 0
```

历史任务仍读取 `contact_snapshot`。

## 7.3 task_reminders

仅保存用户自定义的最多 3 条：

```text
id
task_id
remind_at_ms
message
enabled
fired_at_ms
```

## 7.4 task_postponements

```text
id
task_id
old_deadline_at_ms
new_deadline_at_ms
reason
created_at_ms
```

只追加，不覆盖。

## 7.5 system_reminder_log

用于避免 DDL 系统提醒重复触发：

```text
id
task_id
deadline_snapshot_ms
kind
scheduled_at_ms
fired_at_ms
```

`kind`：

```text
ddl_60
ddl_30
ddl_10
ddl_due
```

DDL 延期后 `deadline_snapshot_ms` 改变，因此新 DDL 可以重新生成提醒。

## 7.6 work_status_records

```text
id
work_date TEXT
status_type
display_copy
start_at_ms INTEGER
end_at_ms INTEGER
```

同一时间最多只有一个 `end_at_ms IS NULL` 的当前工作状态。

切换状态必须：

```text
transaction:
1. 关闭旧状态
2. 创建新状态
```

## 7.7 overtime_records

```text
id
work_date TEXT NOT NULL
start_at_ms INTEGER NOT NULL
end_at_ms INTEGER
auto_end_at_ms INTEGER NOT NULL
end_type
```

`end_type`：

```text
manual
auto
```

`active` 定义为 `end_at_ms IS NULL`。Service 层必须拒绝重复开启加班，SQLite 同时使用 partial unique index 作为最终约束，保证整个数据库同一时刻最多只有一条 active 加班记录：

```sql
CREATE UNIQUE INDEX one_active_overtime
ON overtime_records ((1))
WHERE end_at_ms IS NULL;
```

开始、手动结束、05:00 自动结束和启动补记都必须通过 `OvertimeService` 在 transaction 中执行，并复用同一套 WorkDay / Time Service。

## 7.8 daily_work_overrides

保存“仅今天修改”：

```text
work_date TEXT
start_time TEXT
end_time TEXT
```

`work_date` 使用 `YYYY-MM-DD`，`start_time` / `end_time` 使用 `HH:MM`。

## 7.9 settings

保存业务设置，例如：

```text
default_work_start TEXT
default_work_end TEXT
lunch_start TEXT
lunch_end TEXT
```

以上每日钟表时间统一使用 `HH:MM`。

## 7.10 status_copies

固定状态的用户自定义文案。

```text
id
status_type
content
is_active
created_at_ms
```

## 7.11 busy_level_configs

```text
id
min_tasks
max_tasks
emoji
name
sort_order
```

## 7.12 busy_level_messages

```text
id
busy_level_id
content
```

---

# 8. 时间规则

## 8.1 时间存储格式

绝对时间点统一存为 SQLite `INTEGER`，单位为 Unix epoch milliseconds。包括：

- `created_at_ms` / `updated_at_ms`；
- `planned_at_ms` / `deadline_at_ms`；
- `completed_at_ms` / `cancelled_at_ms`；
- `remind_at_ms` / `scheduled_at_ms` / `fired_at_ms`；
- `start_at_ms` / `end_at_ms` / `auto_end_at_ms`；
- 其他语义为具体瞬间的字段。

禁止使用无 offset 的 ISO 8601 本地时间字符串保存绝对时间点。

业务日期使用 `YYYY-MM-DD`，例如 `work_date`。每日钟表时间使用 `HH:MM`，例如默认上下班和午餐时间。

## 8.2 单一时间服务

所有时间判断必须集中到：

```text
src-tauri/src/time/
```

Rust time 模块统一负责 epoch milliseconds、本地时间、业务日期和每日钟表时间之间的转换。React 不得自行实现另一套“今天”“本周”“工作日归属”“05:00”或 DDL 时间业务规则。

## 8.3 WorkDay Cutoff

WorkDay Cutoff 固定为设备当地时间 `05:00`，只用于加班和工作状态的 `work_date` 归属：

```text
local time < 05:00  → work_date = 前一天
local time >= 05:00 → work_date = 当天
```

加班创建时由同一 WorkDay / Time Service 计算并持久化 `work_date` 与 `auto_end_at_ms`。05:00 自动结束、App 启动 reconciliation 和运行中调度必须复用该服务，不得各自计算截止点。

任务的 planned date、DDL 日历日期和日历任务归属按普通本地日历日期计算，**不使用** 05:00 WorkDay Cutoff。

## 8.4 周规则

- 周一至周日；
- 跨月周归周一所在月份；
- 目录名由同一个 `period_folder` 函数生成；
- 前端不得自己计算另一套周编号。

## 8.5 DDL 进度

```text
progress = (now - plannedAt) / (deadlineAt - plannedAt)
```

边界：

- `now <= plannedAt` → 0%
- `now >= deadlineAt` → 100%+ / overdue
- `deadlineAt <= plannedAt` → 输入校验错误，不保存

前端可动画展示，但业务计算函数应可单元测试。

---

# 9. Reminder Engine

## 9.1 运行位置

Rust 后端。

## 9.2 调度方式

V1 不需要复杂任务队列。

使用轻量周期检查，例如每 30 秒检查一次：

- 用户自定义提醒；
- DDL 60 分钟；
- DDL 30 分钟；
- DDL 10 分钟；
- DDL 到点；
- 加班 05:00 自动结束。

## 9.3 App 完全退出

符合 PRD：

- 进程退出后不保证主动通知；
- 下次启动执行 reconciliation；
- 已逾期任务立即在 UI 突出展示；
- 不补发一串历史 60/30/10 通知。

## 9.4 提醒输出

触发提醒后：

1. 写入 reminder log；
2. 发系统通知；
3. `request_user_attention`；
4. 向 React emit `reminder://triggered`；
5. React 更新/展示本地角色提醒。

---

# 10. DDL 前置小窗口

为了满足“App 打开时最前置窗口提示”，V1 使用一个可复用的 Tauri Reminder Window：

```text
label: ddl-reminder
```

原则：

- 单一窗口复用，不为每次提醒创建无限新窗口；
- always-on-top；
- 小尺寸；
- 非阻塞；
- 显示原创角色 + 文案 + 任务名 + 剩余时间；
- 提供“打开任务”“知道了”；
- 不在多个提醒同时到达时堆叠几十个窗口。

多个任务同时提醒时：

> 窗口显示最紧急任务，并提示“还有 N 个任务也在催”。

---

# 11. 单实例

必须启用 Tauri Single Instance Plugin。

原因：

- 避免两份 App 同时运行；
- 避免两个 Reminder Engine 重复通知；
- 避免两个实例争抢工作目录；
- 第二次启动时聚焦已有窗口。

---

# 12. 前端状态管理

不引入 Redux。

原则：

- SQLite 是业务数据唯一事实源；
- React state 只保存当前页面 UI 状态；
- 页面加载通过 `services/tauri` 获取数据；
- CRUD 成功后重新拉取必要数据或局部更新；
- 不把完整业务数据库复制到全局前端 Store。

允许使用轻量 Context 管理：

- 当前导航；
- 当前 workspace readiness；
- toast；
- reminder overlay；
- theme/design token。

---

# 13. UI 与资源实现

## 13.1 Design Token

统一在：

```text
src/styles/tokens.css
```

至少定义：

```text
--color-paper: #F1ECE0;
--color-green: #117C0D;
--color-wheat: #FAC75E;
```

语义告警色单独定义，不允许业务组件硬编码十几套颜色。

## 13.2 原创角色

资源：

```text
src/assets/mascot/
```

V1 优先：

- SVG 静态姿势；
- CSS keyframes；
- WebP/APNG 小动画。

第一版不强制引入 Lottie。

## 13.3 动画

CSS 动画优先。

例如：

```text
mascot-breathe
mascot-shake
mascot-panic
mascot-angry
```

避免复杂时间线动画库增加依赖。

---

# 14. 错误处理

所有 Rust command 返回结构化错误：

```text
code
message
detail?
```

前端不得直接显示 Rust Debug 字符串。

关键错误码建议：

```text
WORKSPACE_NOT_FOUND
WORKSPACE_NOT_WRITABLE
DB_OPEN_FAILED
DB_MIGRATION_FAILED
TASK_NOT_FOUND
INVALID_DEADLINE
REMINDER_LIMIT_REACHED
BUSY_RULE_INVALID
OVERTIME_ALREADY_ACTIVE
NO_ACTIVE_OVERTIME
```

---

# 15. 日志

V1 仅本地开发日志。

要求：

- 不记录用户任务备注全文；
- 不记录可能包含隐私的完整工作内容；
- 可记录 task id、error code、模块名；
- Release build 不输出大量 debug 日志。

---

# 16. 测试策略

优先测试业务规则，而不是追求高覆盖率数字。

## Rust 单元测试优先

必须覆盖：

- 默认工作目录计算；
- Windows D 盘 fallback 逻辑（通过抽象/模拟）；
- Windows UNC / 网络路径拒绝；
- macOS 网络挂载、移动挂载和已识别云同步目录校验；
- 默认目录和自定义目录共用 `WorkspaceValidator`；
- epoch milliseconds / 本地时间 / `YYYY-MM-DD` / `HH:MM` 转换；
- 周目录计算；
- 跨月周；
- DDL 时间进度；
- DDL 60/30/10 节点；
- 延期后的 reminder snapshot；
- active 加班数据库唯一约束；
- 04:59 与 05:00 的 WorkDay 归属边界；
- 05:00 自动结束加班；
- 跨零点加班归属；
- 任务 planned date / DDL 日期不使用 05:00 cutoff；
- 日历任务去重；
- 忙碌区间校验。

## Frontend 测试优先

覆盖：

- 新建任务表单验证；
- Reminder 最多 3 条；
- 任务卡片不同紧急状态；
- 日历 busy 状态展示；
- 删除/清空类确认 UI。

---

# 17. 打包与发布

## macOS

V1 目标：

```text
.dmg
```

开发阶段可以先本机测试构建。

面向其他用户正式分发前，再处理：

- Code Signing；
- Notarization。

## Windows

V1 推荐：

```text
NSIS setup.exe
```

后续有需要再额外输出 `.msi`。

注意：

Windows 原生通知在已安装应用中表现更符合真实交付环境，因此通知验收必须至少在安装包环境做一次。

---

# 18. V1 不允许的架构扩张

Cursor 不得自行引入：

- 后端 HTTP Server；
- Express / NestJS；
- 云数据库；
- Firebase / Supabase；
- 登录系统；
- AI SDK；
- 向量数据库；
- WebSocket；
- 微服务；
- Docker；
- Electron；
- Redux；
- 大型 UI Design System；
- 在线表情接口；
- 遥测/埋点 SDK。

如果某个任务看起来“必须”引入以上内容，先停止编码并提出原因。
