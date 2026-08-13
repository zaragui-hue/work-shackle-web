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

const MIGRATIONS: &[Migration] = &[Migration {
    version: 1,
    name: "0001_init",
    sql: include_str!("../../migrations/0001_init.sql"),
}];

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
}
