# TASK-0103 SQLite Connection + Migration 0001 设计

## 范围

本任务只实现 Rust 侧 SQLite 连接、migration framework 与 `0001_init.sql`。不接入 Tauri 启动状态机，不实现 UI、任务页面、日历、提醒引擎或加班业务服务。

## 连接

- 使用启用 `bundled` feature 的 `rusqlite`，确保 macOS 与 Windows 使用一致的 SQLite 能力。
- 数据库路径固定为 `<workspace>/.data/work-shackle.db`。
- 打开前仅确保 `<workspace>/.data` 目录存在；不删除、重命名或重建已有数据库。
- 每个连接执行 `PRAGMA foreign_keys = ON`，并设置有限的 `busy_timeout`。
- 不执行 `PRAGMA journal_mode = WAL`。新数据库保留 SQLite 默认 rollback journal。

## Migration Framework

- migration SQL 通过 `include_str!` 编译进应用，避免 Tauri 打包后的运行时资源路径差异。
- migration 清单按版本升序静态注册，版本不可重复。
- 每次初始化开启一个 transaction，在其中：
  1. `CREATE TABLE IF NOT EXISTS schema_migrations`；
  2. 读取已执行版本；
  3. 顺序执行所有待执行 migration；
  4. 每个 migration 成功后记录版本、名称和应用时间；
  5. 所有步骤成功后提交。
- 任意 SQL 或版本记录失败时 transaction 自动 rollback；不得通过删除数据库恢复。
- 已记录的 migration 不重复执行，已有业务数据保持不变。

## 0001 Initial Schema

创建架构规定的业务表：

- `contacts`
- `tasks`
- `task_reminders`
- `task_postponements`
- `system_reminder_log`
- `work_status_records`
- `overtime_records`
- `daily_work_overrides`
- `settings`
- `status_copies`
- `busy_level_configs`
- `busy_level_messages`

绝对时间字段统一使用以 `_at_ms` 结尾的 SQLite `INTEGER`；`work_date` 使用 `TEXT` 保存 `YYYY-MM-DD`；每日钟表时间使用 `TEXT` 保存 `HH:MM`。本 migration 不写入无 offset 的本地时间字符串。

外键引用由 SQLite 约束保护。`overtime_records` 的 active 状态定义为 `end_at_ms IS NULL`，并使用 partial unique index 保证数据库中最多存在一条 active overtime。

## 错误与数据安全

- 连接和 migration 错误向调用者返回，不吞掉错误。
- migration 不包含破坏性数据库重置逻辑。
- migration 失败后，失败 migration 中已执行的 DDL、`schema_migrations` 记录以及首次创建的 migration 元数据表都随 transaction 回滚。
- 二次启动只验证并跳过已应用版本，不覆盖用户数据。

## 测试

1. 首次初始化：在临时 workspace 中创建数据库，检查准确路径、全部初始表、`schema_migrations` 版本、`foreign_keys = 1`、journal mode 不是 WAL，并验证 active overtime partial unique index。
2. 二次启动：首次初始化后插入一条业务数据，再次打开并迁移；确认版本没有重复且业务数据仍存在。
3. 回滚：在测试 migration 中先创建表再执行错误 SQL；确认 migration 返回错误、前置 DDL 不存在且失败版本没有记录。
4. 最终执行完整 `cargo test` 与 `cargo check`。

## 架构一致性

该设计符合 `docs/ARCHITECTURE.md`、`docs/PRD.md` 和 `docs/DEVELOPMENT_PLAN.md` 中 TASK-0103 的约束，未发现与当前 Tauri 2 或 Rust stable 的冲突。
