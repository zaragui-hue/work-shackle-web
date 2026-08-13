# Work Shackle V1 分阶段开发计划

> 核心规则：**禁止一次性让 Cursor “根据 PRD 完成整个 App”。**  
> 每个 TASK 独立完成、独立验收、独立提交。

---

# 0. 阶段总览

| 阶段 | 目标 | 是否可进入下一阶段的关键条件 |
|---|---|---|
| Phase 0 | 工程骨架 | Mac 开发环境能启动 Tauri 空壳 |
| Phase 1 | Workspace + SQLite | 退出重开数据仍存在 |
| Phase 2 | UI Design System + App Shell | 今日/任务/设置骨架完成 |
| Phase 3 | 任务 CRUD + 联系人 | 能完整创建/编辑/完成任务 |
| Phase 4 | 今日工作台 + 工作状态 | 今日任务和状态切换可用 |
| Phase 5 | 下班/加班 | 正常下班、加班、05:00 规则正确 |
| Phase 6 | DDL 进度 + 提醒 | 60/30/10 + 到点事件跑通 |
| Phase 7 | 日历 + 忙碌度 | 月历、数量、自定义忙碌规则可用 |
| Phase 8 | 历史/筛选 + 数据异常 | 历史任务和目录异常处理完善 |
| Phase 9 | 原创角色 + 视觉精修 | 国潮治愈风统一 |
| Phase 10 | 打包与跨平台验收 | macOS/Windows 安装包可安装 |

---

# Phase 0：工程骨架

## 目标

只建立可以运行的 Tauri + React + TypeScript 工程。

## TASK-0001 初始化项目

范围：

- Tauri 2；
- React；
- TypeScript；
- Vite；
- npm；
- 不实现业务；
- 不装大型 UI 库。

验收：

- `npm install` 成功；
- `npm run tauri dev` 可以打开桌面窗口；
- 前端显示 `Work Shackle` 文本；
- console 无阻塞错误。

## TASK-0002 放入工程文档和 Cursor Rules

范围：

- `docs/*`
- `.cursor/rules/*`
- `.cursorignore`
- `.gitignore`

验收：

- Cursor 能识别 Project Rules；
- PRD 在 `docs/PRD.md`；
- 不写业务代码。

## TASK-0003 安装最小依赖

前端：

- date-fns
- react-hook-form
- zod
- lucide-react

Rust/Tauri：

- rusqlite
- chrono
- serde / serde_json
- notification plugin
- dialog plugin
- single-instance plugin

验收：

- Mac dev build 正常；
- Rust compile 正常；
- 依赖没有重复解决同一问题的库。

---

# Phase 1：Workspace + SQLite

> 这是整个项目最先必须稳定的底层。不要先做漂亮 UI。

## TASK-0101 WorkspacePath 配置

实现：

- 读取/写入最小 `workspacePath`；
- Mac 默认目录；
- Windows 默认规则函数；
- Rust `WorkspaceValidator`；
- 默认目录与自定义目录统一经过最终校验；
- Windows 拒绝 UNC / 网络路径；
- macOS 不支持网络挂载和移动挂载目录；
- 对明确识别出的云同步目录提示重新选择本地目录；
- 不建立业务表。

测试：

- 默认路径单元测试；
- custom path 优先；
- Windows D 盘不可用时 fallback Documents；
- UNC / 网络路径拒绝；
- macOS 网络挂载、移动挂载拒绝；
- 已识别云同步目录返回重新选择提示；
- 校验失败时不保存 `workspacePath`。

## TASK-0102 初始化工作目录

实现：

```text
<workspace>/.data/
```

以及当前：

```text
年/月/周
```

目录。

测试：

- 跨月周归属；
- 重复调用不会报错。

## TASK-0103 SQLite Connection + Migration 0001

实现：

- rusqlite；
- schema_migrations；
- transaction migration；
- 初始表；
- 所有绝对时间使用 SQLite `INTEGER` Unix epoch milliseconds；
- `work_date` 使用 `YYYY-MM-DD`；
- 每日钟表时间使用 `HH:MM`；
- overtime active 定义为 `end_at_ms IS NULL`；
- overtime active partial unique index。

不实现 React 页面。

验收：

- 新 DB 能初始化；
- 第二次启动不重复建表；
- migration 失败不会留下半套 schema；
- 数据库约束禁止同时存在两条 active overtime；
- 初始 schema 不含无 offset 的本地时间字符串字段。

## TASK-0104 Workspace 启动状态机

实现：

```text
找路径
→ 校验
→ 初始化目录
→ 打开 DB
→ migration
→ ready
```

前端只显示：

```text
正在准备工作目录
工作目录可用
工作目录找不到
工作目录不受支持
```

## TASK-0105 数据持久化 Smoke Test

创建一个临时测试 command：

- 写入一条 task；
- 退出 App；
- 重开；
- 能查回。

通过后删除临时 UI，保留底层实现。

**Phase 1 Gate：**

> 没有通过“退出重开数据仍在”，禁止进入任务 UI 开发。

---

# Phase 2：视觉基础 + App Shell

## TASK-0201 Design Tokens

实现：

- `#F1ECE0`
- `#117C0D`
- `#FAC75E`
- 字体栈；
- 圆角；
- shadow；
- spacing；
- semantic alert colors。

只创建 token，不做具体业务。

## TASK-0202 基础组件

只做：

- Button
- Card
- Modal
- Drawer
- EmptyState

不要提前建设完整 Design System。

## TASK-0203 App Shell

完成一级导航：

```text
今日
任务
设置
```

总结完全隐藏。

验收：

- 三个 View 能切换；
- 不使用 react-router 也可；
- 页面状态稳定；
- 整体已经呈现米白/深绿/暖黄基调。

---

# Phase 3：任务 CRUD + 联系人

## TASK-0301 Task Repository

Rust：

- create
- update
- get_by_id
- query
- complete
- cancel

先用 Rust tests 验证。

## TASK-0302 Task IPC Bridge

实现：

- Tauri commands
- TypeScript service wrappers
- 结构化错误

不做 UI。

## TASK-0303 新建任务 Modal

字段：

- 名称；
- 备注；
- 计划时间默认 now；
- DDL；
- 紧急程度默认“正常”；
- 对接人；
- 最多 3 个自定义提醒。

使用 Zod 做前端即时校验，Rust 再做最终校验。

## TASK-0304 联系人管理

实现：

- 添加；
- 选择；
- 最近使用；
- 从列表移除；
- 历史 snapshot 不受影响。

## TASK-0305 Task List

先做简单清单：

- title；
- priority；
- status；
- deadline；
- contact。

不要同时开发日历。

## TASK-0306 Task Drawer

实现查看/编辑：

- 备注；
- 状态；
- DDL；
- 联系人；
- 提醒；
- 完成；
- 取消。

## TASK-0307 延期

必须：

- 新 DDL；
- 原因；
- history append；
- 新 DDL 生效。

**Phase 3 Gate：**

手工完成：

```text
创建 → 编辑 → 延期 → 完成 → 重启 App → 数据仍正确
```

---

# Phase 4：今日工作台 + 工作状态

## TASK-0401 今日任务查询

Rust service 统一计算：

- planned today；
- deadline today；
- overdue；
- completed today。

避免 React 拼 SQL 逻辑。

## TASK-0402 今日任务 UI

分区：

- DDL 临近；
- 今日正式安排；
- 历史欠账；
- 今日已完成。

## TASK-0403 工作时间设置

实现：

- 默认上/下班时间；
- 仅今天修改；
- 第二天恢复默认。

## TASK-0404 下班倒计时

React 每秒刷新展示即可。

业务 end time 从 Rust/settings 获取。

不上班前倒计时。

## TASK-0405 固定工作状态

实现固定状态切换：

- 状态名不可改；
- 图标不可改；
- 顺序不可改；
- 文案可多条；
- 切换随机抽文案；
- 记录状态 timeline；
- 工作状态 `work_date` 使用当地时间 05:00 WorkDay Cutoff。

## TASK-0406 午餐提醒

实现：

- 午餐默认时间；
- 到点轻提醒；
- 不强制切换状态。

---

# Phase 5：正常下班 + 加班

## TASK-0501 下班决策

达到下班时间：

```text
正常下班
开启加班
```

不得自动开始加班。

## TASK-0502 加班记录

实现：

- begin；
- manual end；
- timer；
- 自动进入“加班中”；
- Service 层拒绝重复 active；
- SQLite partial unique index 作为最终约束；
- 创建时通过 WorkDay / Time Service 写入 `work_date` 和 `auto_end_at_ms`。

## TASK-0503 05:00 Reconciliation

必须先写 Rust 单元测试：

- 当晚手动结束；
- 跨 00:00；
- local time < 05:00 归前一 `work_date`；
- local time >= 05:00 归当天 `work_date`；
- 04:59 仍 active；
- 05:00 自动结束；
- App 09:00 再开时补记 05:00；
- reconciliation 不覆盖手动结束；
- 任务 planned date / DDL 日期不使用 05:00 cutoff。

## TASK-0504 App 运行中 05:00 自动结束

Reminder Engine / scheduler 执行。

**Phase 5 Gate：**

修改系统时间或用可注入 clock 测试，不依赖真的熬夜到 05:00。

---

# Phase 6：DDL 时间进度 + Reminder Engine

## TASK-0601 DDL Progress 纯函数

先测试：

- 0–40；
- 40–65；
- 65–80；
- 80–95；
- 95–100；
- overdue；
- invalid interval。

## TASK-0602 时间进度 UI

任务卡片和 Drawer 显示：

- 时间进度；
- 剩余时间；
- 情绪等级。

明确不写“任务完成 75%”。

## TASK-0603 用户自定义 Reminder

Rust：

- 最多 3；
- `fired_at_ms`；
- 已完成后不再触发。

## TASK-0604 系统 DDL Reminder 计算

生成：

- 60min；
- 30min；
- 10min；
- due。

用 `deadline_snapshot_ms` 防重复。

## TASK-0605 Reminder Engine

每 30 秒轮询。

先只写 log / emit，不做漂亮弹窗。

## TASK-0606 系统通知

接 Tauri Notification Plugin。

注意 Windows 需要在安装应用场景做最终验收。

## TASK-0607 Window Attention

- macOS Dock；
- Windows Taskbar。

先验证 native 行为。

## TASK-0608 DDL Reminder Window

实现单一复用的小窗口：

- always-on-top；
- 任务名；
- 剩余时间；
- “打开任务”；
- “知道了”。

先用占位角色。

**Phase 6 Gate：**

用 2–3 分钟后的测试 DDL 完成一轮端到端：

```text
自定义提醒 / 系统提醒
→ native notification
→ attention
→ reminder window
→ 标记完成
→ 后续提醒停止
```

---

# Phase 7：日历 + 忙碌度

## TASK-0701 月历日期网格

使用 date-fns 自己构建。

不引入 FullCalendar。

## TASK-0702 每日任务数量查询

Rust service：

- planned date；
- DDL date；
- 同日 task id 去重；
- overdue 不污染未来 busy。

## TASK-0703 日历 Busy UI

每格显示：

- date；
- count；
- busy emoji/state。

## TASK-0704 点击日期 Drawer

查看当天任务。

## TASK-0705 Busy Rule 编辑器

用户可以改：

- 档位数量；
- min/max；
- emoji；
- name；
- 多条文案。

## TASK-0706 Busy Rule Validation

Rust 最终校验：

- 从 0 开始；
- 不重叠；
- 不留空档；
- 最后一档 X+；
- name 非空。

提供恢复默认。

---

# Phase 8：历史、筛选、异常流程

## TASK-0801 历史时间筛选

同一页面支持：

- 日；
- 周；
- 月；
- 季度；
- 年；
- 自定义。

## TASK-0802 业务筛选

- status；
- priority；
- contact；
- keyword。

## TASK-0803 Workspace Missing

测试：

- 启动前目录被删除；
- 运行中目录被删除；
- 不允许假保存成功。

## TASK-0804 Workspace 切换

执行：

```text
copy
→ validate
→ switch
```

旧目录不自动删除。

## TASK-0805 单实例

第二次启动时：

- 不打开第二个数据库连接；
- 聚焦已有 App。

---

# Phase 9：原创角色 + 视觉精修

> 必须在功能闭环稳定后再做，避免 Cursor 一边改数据层一边重写 UI。

## TASK-0901 Mascot Asset Contract

先确定资源命名：

```text
work-neutral
meeting-empty
fish-relax
lunch-happy
ddl-calm
ddl-anxious
ddl-panic
ddl-due
ddl-overdue
overtime-dead-eyes
offwork-run
```

## TASK-0902 替换占位角色

不改业务代码，只换资源映射。

## TASK-0903 Micro Animation

CSS：

- breathe；
- shake；
- panic；
- angry；
- run。

## TASK-0904 文案池

将 V1 默认文案集中到配置/seed，不散落在 JSX。

## TASK-0905 视觉一致性 Review

逐页检查：

- 今日；
- 任务；
- 日历；
- 设置；
- reminder window。

不允许“顺手”重构后端。

---

# Phase 10：打包与跨平台验收

## TASK-1001 macOS DMG

- build；
- install；
- launch；
- workspace；
- notification；
- Dock attention；
- reopen persistence。

## TASK-1002 Windows NSIS setup.exe

必须在 Windows 环境验收：

- install；
- D 盘存在；
- D 盘不存在 fallback；
- notification；
- Taskbar flash；
- SQLite persistence。

## TASK-1003 Release Smoke Test

至少完成：

1. 首次安装；
2. 默认工作目录；
3. 自定义目录；
4. 创建 5 个任务；
5. DDL；
6. 延期；
7. 完成；
8. 工作状态；
9. 下班；
10. 加班；
11. 重启；
12. 日历；
13. 删除 workspace 后重开。

---

# Cursor 每个 TASK 的规模控制

推荐单 TASK：

- 30–90 分钟；
- 修改 3–6 个核心文件；
- 一个明确业务目标；
- 一个明确测试目标。

如果 Cursor 的 Plan 显示要：

- 修改 > 8 个主要文件；
- 同时跨 frontend + DB migration + reminder + calendar；
- 引入新的架构层；

先拆成两个 TASK。

---

# 提交建议

每个 TASK 完成后：

```text
git status
npm test / cargo test
手工验收
git add
git commit
```

Commit 示例：

```text
feat(workspace): initialize user workspace
feat(tasks): add task creation
feat(overtime): reconcile auto end at 05:00
feat(reminders): add ddl 60/30/10 scheduling
```

不要攒一个阶段才提交。
