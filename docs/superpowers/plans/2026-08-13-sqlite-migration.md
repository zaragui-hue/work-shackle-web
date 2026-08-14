# TASK-0103 SQLite Connection + Migration 0001 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 使用 rusqlite 安全打开 `<workspace>/.data/work-shackle.db`，以 transaction 执行可重复启动且失败可回滚的 migration，并创建 0001 初始 schema。

**Architecture:** `db::connection` 只负责路径、目录、连接配置和初始化入口；`db::migrations` 负责静态 migration 清单、版本表和事务执行；SQL schema 独立存放在 `src-tauri/migrations/0001_init.sql` 并通过 `include_str!` 编译进程序。测试直接使用临时目录和真实 SQLite，不使用 mock。

**Tech Stack:** Rust stable、Tauri 2、rusqlite（`bundled`）、SQLite、tempfile

## Global Constraints

- 数据库固定为 `<workspace>/.data/work-shackle.db`。
- 每个连接启用 `PRAGMA foreign_keys = ON`。
- 不启用 WAL，不使用 Tauri SQL Plugin。
- migration 必须在 transaction 中执行并使用 `schema_migrations`。
- migration 失败必须 rollback，禁止删除或重建数据库来恢复。
- 只实现 DB connection、migration framework 和 0001 initial schema。
- 不实现 UI、Task 页面、Calendar、Reminder 或 Overtime 业务逻辑。
- 不提交 git commit，除非用户另行明确要求。

---

### Task 1: SQLite Connection

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/Cargo.lock`
- Modify: `src-tauri/src/lib.rs`
- Create: `src-tauri/src/db/mod.rs`
- Create: `src-tauri/src/db/connection.rs`

**Interfaces:**
- Produces: `database_path(workspace: &Path) -> PathBuf`
- Produces: `open_connection(workspace: &Path) -> Result<Connection, DbError>`
- Produces: `DbError::{Io, Sqlite}`

- [ ] **Step 1: Add rusqlite configuration**

Run:

```bash
cd src-tauri
cargo add rusqlite --features bundled
```

Expected: `Cargo.toml` contains rusqlite with `bundled`; `Cargo.lock` is updated.

- [ ] **Step 2: Write failing connection tests**

Create `src-tauri/src/db/mod.rs`:

```rust
pub mod connection;
pub mod migrations;
```

Expose `mod db;` from `src-tauri/src/lib.rs`. In `connection.rs`, first add tests that require:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_database_at_workspace_data_path_with_safe_pragmas() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = open_connection(temp.path()).expect("open database");

        assert_eq!(
            database_path(temp.path()),
            temp.path().join(".data/work-shackle.db")
        );
        assert!(database_path(temp.path()).is_file());
        assert_eq!(
            connection
                .pragma_query_value(None, "foreign_keys", |row| row.get::<_, i64>(0))
                .expect("foreign_keys"),
            1
        );
        let journal_mode: String = connection
            .pragma_query_value(None, "journal_mode", |row| row.get(0))
            .expect("journal_mode");
        assert_ne!(journal_mode.to_ascii_lowercase(), "wal");
    }
}
```

- [ ] **Step 3: Verify RED**

Run:

```bash
cd src-tauri
cargo test db::connection::tests::opens_database_at_workspace_data_path_with_safe_pragmas
```

Expected: compilation fails because `open_connection` and `database_path` do not exist.

- [ ] **Step 4: Implement the minimal connection**

Implement:

```rust
use std::{fs, path::{Path, PathBuf}, time::Duration};

use rusqlite::Connection;

pub const DATABASE_FILE_NAME: &str = "work-shackle.db";

#[derive(Debug)]
pub enum DbError {
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
}

impl From<std::io::Error> for DbError {
    fn from(error: std::io::Error) -> Self { Self::Io(error) }
}

impl From<rusqlite::Error> for DbError {
    fn from(error: rusqlite::Error) -> Self { Self::Sqlite(error) }
}

pub fn database_path(workspace: &Path) -> PathBuf {
    workspace.join(".data").join(DATABASE_FILE_NAME)
}

pub fn open_connection(workspace: &Path) -> Result<Connection, DbError> {
    let path = database_path(workspace);
    let data_dir = path.parent().expect("database path always has a parent");
    fs::create_dir_all(data_dir)?;

    let connection = Connection::open(path)?;
    connection.pragma_update(None, "foreign_keys", true)?;
    connection.busy_timeout(Duration::from_secs(5))?;
    Ok(connection)
}
```

Add focused `Display` and `Error` implementations without exposing user data.

- [ ] **Step 5: Verify GREEN**

Run the focused test again. Expected: one test passes and journal mode is not WAL.

---

### Task 2: Transactional Migration Framework

**Files:**
- Create: `src-tauri/src/db/migrations.rs`
- Modify: `src-tauri/src/db/connection.rs`

**Interfaces:**
- Consumes: `DbError`, mutable `rusqlite::Connection`
- Produces: `run_migrations(connection: &mut Connection) -> Result<(), DbError>`
- Produces: `initialize_database(workspace: &Path) -> Result<Connection, DbError>`

- [ ] **Step 1: Write failing rollback test**

Define a private test migration list containing SQL that first creates `rollback_probe` and then references invalid SQL:

```rust
#[test]
fn failed_migration_rolls_back_schema_and_version_record() {
    let mut connection = Connection::open_in_memory().expect("in-memory database");
    connection
        .pragma_update(None, "foreign_keys", true)
        .expect("foreign keys");

    let migrations = [Migration {
        version: 99,
        name: "broken",
        sql: "CREATE TABLE rollback_probe (id INTEGER); THIS IS INVALID SQL;",
    }];

    assert!(run_migration_list(&mut connection, &migrations).is_err());
    let probe_exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'rollback_probe'",
            [],
            |row| row.get(0),
        )
        .expect("probe query");
    assert_eq!(probe_exists, 0);

    let migrations_table_exists: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'",
            [],
            |row| row.get(0),
        )
        .expect("migration table query");
    assert_eq!(migrations_table_exists, 0);
}
```

- [ ] **Step 2: Verify RED**

Run the focused rollback test. Expected: compilation fails because `Migration` and `run_migration_list` do not exist.

- [ ] **Step 3: Implement the migration transaction**

Implement a static migration descriptor and runner:

```rust
struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "0001_init",
    sql: include_str!("../../migrations/0001_init.sql"),
}];

pub fn run_migrations(connection: &mut Connection) -> Result<(), DbError> {
    run_migration_list(connection, MIGRATIONS)
}
```

`run_migration_list` must validate strictly increasing positive versions, then use one `TransactionBehavior::Immediate` transaction to:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at_ms INTEGER NOT NULL
);
```

For each missing version, call `transaction.execute_batch(migration.sql)` and insert its version with an epoch-millisecond timestamp. Commit only after all pending migrations succeed.

- [ ] **Step 4: Verify GREEN**

Run the rollback test. Expected: migration returns an error and both `rollback_probe` and `schema_migrations` remain absent.

---

### Task 3: 0001 Initial Schema and Idempotent Startup

**Files:**
- Create: `src-tauri/migrations/0001_init.sql`
- Modify: `src-tauri/src/db/connection.rs`
- Modify: `src-tauri/src/db/migrations.rs`

**Interfaces:**
- Consumes: static migration runner
- Produces: `initialize_database` that opens, configures and migrates a workspace database

- [ ] **Step 1: Write failing first-initialization test**

The test must call `initialize_database`, query `sqlite_master`, and assert the presence of:

```text
schema_migrations, contacts, tasks, task_reminders, task_postponements,
system_reminder_log, work_status_records, overtime_records,
daily_work_overrides, settings, status_copies, busy_level_configs,
busy_level_messages
```

It must also assert version `1`, `foreign_keys = 1`, journal mode is not WAL, all architecture-defined `*_at_ms` columns have declared type `INTEGER`, and no schema column stores an absolute instant in an offset-less local datetime field.

- [ ] **Step 2: Write failing second-startup test**

Initialize once, insert a contact, drop the connection, initialize again, then assert:

```rust
assert_eq!(migration_count, 1);
assert_eq!(contact_count, 1);
```

- [ ] **Step 3: Write failing active-overtime constraint test**

Insert one `overtime_records` row with `end_at_ms = NULL`, then assert inserting a second active row fails with a constraint violation. End the first row and assert a new active row can then be inserted.

- [ ] **Step 4: Verify RED**

Run the three focused tests. Expected: they fail because `0001_init.sql` has not created the required schema.

- [ ] **Step 5: Implement 0001 SQL**

Create all tables listed above using architecture field names. Apply:

- `INTEGER` for every absolute `*_at_ms` instant.
- `TEXT NOT NULL` for `work_date`; `TEXT` for `HH:MM` setting values.
- `CHECK` constraints for booleans, priority, task status and overtime `end_type`.
- foreign keys for task/contact, reminder/task, postponement/task, reminder-log/task and busy-message/config relations.
- `CREATE UNIQUE INDEX one_active_overtime ON overtime_records ((1)) WHERE end_at_ms IS NULL`.
- supporting indexes for task planned/deadline/status and reminder lookup.

Do not seed UI copy or implement CRUD.

- [ ] **Step 6: Wire initialization**

Implement:

```rust
pub fn initialize_database(workspace: &Path) -> Result<Connection, DbError> {
    let mut connection = open_connection(workspace)?;
    super::migrations::run_migrations(&mut connection)?;
    Ok(connection)
}
```

- [ ] **Step 7: Verify GREEN**

Run all DB-focused tests. Expected: first initialization, second startup, rollback and overtime uniqueness tests pass.

---

### Task 4: Final Verification

**Files:**
- Review all TASK-0103 files only.

- [ ] **Step 1: Format**

Run:

```bash
cd src-tauri
cargo fmt --check
```

If formatting fails, run `cargo fmt`, then repeat `cargo fmt --check`.

- [ ] **Step 2: Run all tests**

Run:

```bash
cd src-tauri
cargo test
```

Expected: exit code 0 with no failed tests.

- [ ] **Step 3: Run compiler check**

Run:

```bash
cd src-tauri
cargo check
```

Expected: exit code 0.

- [ ] **Step 4: Scope and safety review**

Confirm:

- no UI/frontend files changed;
- no WAL or Tauri SQL Plugin was added;
- no database deletion/reset logic exists;
- all migration DDL and version writes occur inside one transaction;
- tests explicitly cover first initialization, second startup and rollback.

## Self-Review

- Spec coverage: all TASK-0103 implementation and acceptance requirements map to Tasks 1–4.
- Placeholder scan: passed; every implementation step is concrete.
- Type consistency: `DbError`, `open_connection`, `run_migrations` and `initialize_database` signatures are consistent across tasks.
