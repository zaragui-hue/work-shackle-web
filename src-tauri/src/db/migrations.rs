use std::{
    collections::BTreeSet,
    io,
    time::{SystemTime, UNIX_EPOCH},
};

use rusqlite::{params, Connection, TransactionBehavior};

use super::connection::DbError;

struct Migration {
    version: i64,
    name: &'static str,
    sql: &'static str,
}

const MIGRATIONS: &[Migration] = &[
    Migration {
        version: 1,
        name: "0001_init",
        sql: include_str!("../../migrations/0001_init.sql"),
    },
    Migration {
        version: 2,
        name: "0002_lunch_reminder_log",
        sql: include_str!("../../migrations/0002_lunch_reminder_log.sql"),
    },
    Migration {
        version: 3,
        name: "0003_work_end_decisions",
        sql: include_str!("../../migrations/0003_work_end_decisions.sql"),
    },
    Migration {
        version: 4,
        name: "0004_system_reminder_dedupe",
        sql: include_str!("../../migrations/0004_system_reminder_dedupe.sql"),
    },
];

pub fn run_migrations(connection: &mut Connection) -> Result<(), DbError> {
    run_migration_list(connection, MIGRATIONS)
}

fn run_migration_list(
    connection: &mut Connection,
    migrations: &[Migration],
) -> Result<(), DbError> {
    validate_migration_order(migrations)?;

    let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
    transaction.execute_batch(
        "CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at_ms INTEGER NOT NULL
        );",
    )?;

    let applied_versions = {
        let mut statement = transaction.prepare("SELECT version FROM schema_migrations")?;
        let versions = statement.query_map([], |row| row.get::<_, i64>(0))?;
        versions.collect::<rusqlite::Result<BTreeSet<_>>>()?
    };

    for migration in migrations {
        if applied_versions.contains(&migration.version) {
            continue;
        }

        transaction.execute_batch(migration.sql)?;
        transaction.execute(
            "INSERT INTO schema_migrations (version, name, applied_at_ms)
             VALUES (?1, ?2, ?3)",
            params![migration.version, migration.name, epoch_milliseconds()?],
        )?;
    }

    transaction.commit()?;
    Ok(())
}

fn validate_migration_order(migrations: &[Migration]) -> Result<(), DbError> {
    let is_valid = migrations
        .iter()
        .map(|migration| migration.version)
        .try_fold(0_i64, |previous, version| {
            (version > previous).then_some(version)
        })
        .is_some();

    if is_valid {
        Ok(())
    } else {
        Err(DbError::InvalidMigrationOrder)
    }
}

fn epoch_milliseconds() -> Result<i64, DbError> {
    let duration = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| io::Error::other(error.to_string()))?;
    Ok(duration
        .as_millis()
        .try_into()
        .map_err(|_| io::Error::other("current epoch milliseconds exceed i64"))?)
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    use super::*;

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
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table' AND name = 'rollback_probe'",
                [],
                |row| row.get(0),
            )
            .expect("probe query");
        assert_eq!(probe_exists, 0);

        let migrations_table_exists: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table' AND name = 'schema_migrations'",
                [],
                |row| row.get(0),
            )
            .expect("migration table query");
        assert_eq!(migrations_table_exists, 0);
    }

    #[test]
    fn upgrades_existing_0001_database_to_0002_preserving_business_data() {
        let temp = tempfile::tempdir().expect("tempdir");
        let db_path = temp.path().join("work-shackle.db");
        let mut connection = Connection::open(&db_path).expect("open database");
        connection
            .pragma_update(None, "foreign_keys", true)
            .expect("foreign keys");

        run_migration_list(&mut connection, &MIGRATIONS[..1]).expect("apply 0001 only");

        let versions_after_0001: Vec<i64> = connection
            .prepare("SELECT version FROM schema_migrations ORDER BY version")
            .expect("migration query")
            .query_map([], |row| row.get(0))
            .expect("migration rows")
            .collect::<rusqlite::Result<_>>()
            .expect("migration versions");
        assert_eq!(versions_after_0001, vec![1]);

        let lunch_table_exists_before: i64 = connection
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master
                 WHERE type = 'table' AND name = 'lunch_reminder_log'",
                [],
                |row| row.get(0),
            )
            .expect("lunch table probe");
        assert_eq!(lunch_table_exists_before, 0);

        connection
            .execute(
                "INSERT INTO contacts
                 (id, name, is_active, created_at_ms, updated_at_ms)
                 VALUES ('contact-upgrade', 'Upgrade Contact', 1, 1000, 1000)",
                [],
            )
            .expect("insert contact");
        connection
            .execute(
                "INSERT INTO settings
                 (id, default_work_start, default_work_end, lunch_start, lunch_end, updated_at_ms)
                 VALUES (1, '09:30', '18:30', '12:00', '13:00', 1000)",
                [],
            )
            .expect("insert settings");
        connection
            .execute(
                "INSERT INTO tasks
                 (id, title, planned_at_ms, priority, status, created_at_ms, updated_at_ms)
                 VALUES ('task-upgrade', 'Upgrade Task', 1000, 2, 'not_started', 1000, 1000)",
                [],
            )
            .expect("insert task");
        connection
            .execute(
                "INSERT INTO work_status_records
                 (id, work_date, status_type, display_copy, start_at_ms, end_at_ms)
                 VALUES ('status-upgrade', '2026-08-14', 'working', 'upgrade copy', 1000, NULL)",
                [],
            )
            .expect("insert work status");
        connection
            .execute(
                "INSERT INTO status_copies
                 (id, status_type, content, is_active, created_at_ms)
                 VALUES ('copy-upgrade', 'working', 'upgrade status copy', 1, 1000)",
                [],
            )
            .expect("insert status copy");

        let tables_before_upgrade = table_names(&connection);

        run_migration_list(&mut connection, MIGRATIONS).expect("upgrade to latest");

        let versions_after_upgrade: Vec<i64> = connection
            .prepare("SELECT version FROM schema_migrations ORDER BY version")
            .expect("migration query")
            .query_map([], |row| row.get(0))
            .expect("migration rows")
            .collect::<rusqlite::Result<_>>()
            .expect("migration versions");
        assert_eq!(versions_after_upgrade, vec![1, 2, 3, 4]);

        let lunch_columns: Vec<(String, String)> = connection
            .prepare("PRAGMA table_info(\"lunch_reminder_log\")")
            .expect("table info")
            .query_map([], |row| {
                Ok((row.get::<_, String>(1)?, row.get::<_, String>(2)?))
            })
            .expect("table info rows")
            .collect::<rusqlite::Result<_>>()
            .expect("table columns");
        assert_eq!(
            lunch_columns,
            vec![
                ("reminder_date".to_string(), "TEXT".to_string()),
                ("fired_at_ms".to_string(), "INTEGER".to_string()),
            ]
        );

        let tables_after_upgrade = table_names(&connection);
        assert!(tables_before_upgrade.is_subset(&tables_after_upgrade));
        assert!(tables_after_upgrade.contains("lunch_reminder_log"));
        assert!(tables_after_upgrade.contains("work_end_decisions"));

        let contact_name: String = connection
            .query_row(
                "SELECT name FROM contacts WHERE id = 'contact-upgrade'",
                [],
                |row| row.get(0),
            )
            .expect("contact preserved");
        assert_eq!(contact_name, "Upgrade Contact");

        let lunch_start: String = connection
            .query_row("SELECT lunch_start FROM settings WHERE id = 1", [], |row| {
                row.get(0)
            })
            .expect("settings preserved");
        assert_eq!(lunch_start, "12:00");

        let task_title: String = connection
            .query_row(
                "SELECT title FROM tasks WHERE id = 'task-upgrade'",
                [],
                |row| row.get(0),
            )
            .expect("task preserved");
        assert_eq!(task_title, "Upgrade Task");

        let status_type: String = connection
            .query_row(
                "SELECT status_type FROM work_status_records WHERE id = 'status-upgrade'",
                [],
                |row| row.get(0),
            )
            .expect("work status preserved");
        assert_eq!(status_type, "working");

        let copy_content: String = connection
            .query_row(
                "SELECT content FROM status_copies WHERE id = 'copy-upgrade'",
                [],
                |row| row.get(0),
            )
            .expect("status copy preserved");
        assert_eq!(copy_content, "upgrade status copy");

        run_migration_list(&mut connection, MIGRATIONS).expect("idempotent rerun");

        let migration_count: i64 = connection
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("migration count");
        assert_eq!(migration_count, 4);
    }

    fn table_names(connection: &Connection) -> BTreeSet<String> {
        let mut statement = connection
            .prepare(
                "SELECT name FROM sqlite_master
                 WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
            )
            .expect("table query");
        statement
            .query_map([], |row| row.get::<_, String>(0))
            .expect("table rows")
            .collect::<rusqlite::Result<_>>()
            .expect("table names")
    }
}
