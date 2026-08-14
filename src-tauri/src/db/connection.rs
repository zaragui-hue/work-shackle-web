use std::{
    fs,
    path::{Path, PathBuf},
    time::Duration,
};

use rusqlite::Connection;

pub const DATABASE_FILE_NAME: &str = "work-shackle.db";

#[derive(Debug)]
pub enum DbError {
    Io(std::io::Error),
    Sqlite(rusqlite::Error),
    InvalidMigrationOrder,
}

impl std::fmt::Display for DbError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Io(error) => write!(formatter, "database filesystem operation failed: {error}"),
            Self::Sqlite(error) => write!(formatter, "sqlite operation failed: {error}"),
            Self::InvalidMigrationOrder => {
                write!(
                    formatter,
                    "migration versions must be positive and strictly increasing"
                )
            }
        }
    }
}

impl std::error::Error for DbError {}

impl From<std::io::Error> for DbError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<rusqlite::Error> for DbError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

pub fn database_path(workspace: &Path) -> PathBuf {
    workspace.join(".data").join(DATABASE_FILE_NAME)
}

pub fn open_connection(workspace: &Path) -> Result<Connection, DbError> {
    let path = database_path(workspace);
    let data_dir = path
        .parent()
        .expect("the database path always has a parent directory");
    fs::create_dir_all(data_dir)?;

    let connection = Connection::open(path)?;
    connection.pragma_update(None, "foreign_keys", true)?;
    connection.busy_timeout(Duration::from_secs(5))?;

    Ok(connection)
}

pub fn initialize_database(workspace: &Path) -> Result<Connection, DbError> {
    let mut connection = open_connection(workspace)?;
    super::migrations::run_migrations(&mut connection)?;
    Ok(connection)
}

#[cfg(test)]
mod tests {
    use std::collections::{BTreeMap, BTreeSet};

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

    #[test]
    fn first_initialization_creates_complete_initial_schema() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");

        let expected_tables = BTreeSet::from([
            "busy_level_configs".to_string(),
            "busy_level_messages".to_string(),
            "contacts".to_string(),
            "daily_work_overrides".to_string(),
            "lunch_reminder_log".to_string(),
            "overtime_records".to_string(),
            "schema_migrations".to_string(),
            "settings".to_string(),
            "status_copies".to_string(),
            "system_reminder_log".to_string(),
            "task_postponements".to_string(),
            "task_reminders".to_string(),
            "tasks".to_string(),
            "work_status_records".to_string(),
        ]);
        let actual_tables = {
            let mut statement = connection
                .prepare(
                    "SELECT name FROM sqlite_master
                     WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
                )
                .expect("table query");
            statement
                .query_map([], |row| row.get::<_, String>(0))
                .expect("table rows")
                .collect::<rusqlite::Result<BTreeSet<_>>>()
                .expect("table names")
        };
        assert_eq!(actual_tables, expected_tables);

        let applied_versions: Vec<i64> = connection
            .prepare("SELECT version FROM schema_migrations ORDER BY version")
            .expect("migration query")
            .query_map([], |row| row.get(0))
            .expect("migration rows")
            .collect::<rusqlite::Result<_>>()
            .expect("migration versions");
        assert_eq!(applied_versions, vec![1, 2]);

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

        for table in expected_tables
            .iter()
            .filter(|table| table.as_str() != "schema_migrations")
        {
            let pragma = format!("PRAGMA table_info(\"{table}\")");
            let mut statement = connection.prepare(&pragma).expect("table info query");
            let columns = statement
                .query_map([], |row| {
                    Ok((row.get::<_, String>(1)?, row.get::<_, String>(2)?))
                })
                .expect("table info rows")
                .collect::<rusqlite::Result<Vec<_>>>()
                .expect("table columns");

            for (name, declared_type) in columns {
                if name.ends_with("_at_ms") {
                    assert_eq!(
                        declared_type.to_ascii_uppercase(),
                        "INTEGER",
                        "{table}.{name} must store epoch milliseconds as INTEGER"
                    );
                }
                assert!(
                    !name.ends_with("_at"),
                    "{table}.{name} must not store an offset-less local datetime"
                );
            }
        }
    }

    #[test]
    fn daily_clock_settings_use_explicit_text_columns() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");

        let settings_columns = column_types(&connection, "settings");
        assert_eq!(
            settings_columns,
            BTreeMap::from([
                ("default_work_end".to_string(), "TEXT".to_string()),
                ("default_work_start".to_string(), "TEXT".to_string()),
                ("id".to_string(), "INTEGER".to_string()),
                ("lunch_end".to_string(), "TEXT".to_string()),
                ("lunch_start".to_string(), "TEXT".to_string()),
                ("updated_at_ms".to_string(), "INTEGER".to_string()),
            ])
        );

        let override_columns = column_types(&connection, "daily_work_overrides");
        assert_eq!(override_columns.get("work_date"), Some(&"TEXT".to_string()));
        assert_eq!(
            override_columns.get("start_time"),
            Some(&"TEXT".to_string())
        );
        assert_eq!(override_columns.get("end_time"), Some(&"TEXT".to_string()));
    }

    #[test]
    fn second_startup_skips_applied_migration_and_preserves_data() {
        let temp = tempfile::tempdir().expect("tempdir");
        let first = initialize_database(temp.path()).expect("first initialization");
        first
            .execute(
                "INSERT INTO contacts
                 (id, name, is_active, created_at_ms, updated_at_ms)
                 VALUES ('contact-1', 'Test Contact', 1, 1, 1)",
                [],
            )
            .expect("insert contact");
        drop(first);

        let second = initialize_database(temp.path()).expect("second initialization");
        let migration_count: i64 = second
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("migration count");
        let contact_count: i64 = second
            .query_row("SELECT COUNT(*) FROM contacts", [], |row| row.get(0))
            .expect("contact count");

        assert_eq!(migration_count, 2);
        assert_eq!(contact_count, 1);
    }

    #[test]
    fn initial_schema_allows_only_one_active_overtime_record() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");

        connection
            .execute(
                "INSERT INTO overtime_records
                 (id, work_date, start_at_ms, end_at_ms, auto_end_at_ms, end_type)
                 VALUES ('overtime-1', '2026-08-13', 1000, NULL, 2000, NULL)",
                [],
            )
            .expect("first active overtime");

        let duplicate = connection.execute(
            "INSERT INTO overtime_records
             (id, work_date, start_at_ms, end_at_ms, auto_end_at_ms, end_type)
             VALUES ('overtime-2', '2026-08-13', 1100, NULL, 2000, NULL)",
            [],
        );
        assert!(duplicate.is_err());

        connection
            .execute(
                "UPDATE overtime_records
                 SET end_at_ms = 1500, end_type = 'manual'
                 WHERE id = 'overtime-1'",
                [],
            )
            .expect("end first overtime");
        connection
            .execute(
                "INSERT INTO overtime_records
                 (id, work_date, start_at_ms, end_at_ms, auto_end_at_ms, end_type)
                 VALUES ('overtime-2', '2026-08-13', 1600, NULL, 2000, NULL)",
                [],
            )
            .expect("new active overtime after ending first");
    }

    fn column_types(connection: &Connection, table: &str) -> BTreeMap<String, String> {
        let pragma = format!("PRAGMA table_info(\"{table}\")");
        let mut statement = connection.prepare(&pragma).expect("table info query");
        statement
            .query_map([], |row| {
                Ok((row.get::<_, String>(1)?, row.get::<_, String>(2)?))
            })
            .expect("table info rows")
            .collect::<rusqlite::Result<_>>()
            .expect("column types")
    }
}
