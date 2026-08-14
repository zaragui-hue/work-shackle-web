use chrono::NaiveDate;
use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;
use crate::time::calendar_day::format_work_date;

pub const DEFAULT_WORK_START: &str = "09:30";
pub const DEFAULT_WORK_END: &str = "18:30";
pub const DEFAULT_LUNCH_START: &str = "12:00";
pub const DEFAULT_LUNCH_END: &str = "13:00";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SettingsRow {
    pub default_work_start: String,
    pub default_work_end: String,
    pub lunch_start: String,
    pub lunch_end: String,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct DailyWorkOverride {
    pub work_date: String,
    pub start_time: String,
    pub end_time: String,
}

#[derive(Debug)]
pub enum SettingsRepositoryError {
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for SettingsRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid settings input: {message}")
            }
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for SettingsRepositoryError {}

impl From<DbError> for SettingsRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for SettingsRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub struct SettingsRepository;

impl SettingsRepository {
    pub fn ensure_defaults(
        connection: &Connection,
        updated_at_ms: i64,
    ) -> Result<(), SettingsRepositoryError> {
        let count: i64 =
            connection.query_row("SELECT COUNT(*) FROM settings", [], |row| row.get(0))?;
        if count > 0 {
            return Ok(());
        }

        connection.execute(
            "INSERT INTO settings (
                id, default_work_start, default_work_end, lunch_start, lunch_end, updated_at_ms
             ) VALUES (1, ?1, ?2, ?3, ?4, ?5)",
            params![
                DEFAULT_WORK_START,
                DEFAULT_WORK_END,
                DEFAULT_LUNCH_START,
                DEFAULT_LUNCH_END,
                updated_at_ms,
            ],
        )?;

        Ok(())
    }

    pub fn get_settings(connection: &Connection) -> Result<SettingsRow, SettingsRepositoryError> {
        connection
            .query_row(
                "SELECT default_work_start, default_work_end, lunch_start, lunch_end, updated_at_ms
                 FROM settings
                 WHERE id = 1",
                [],
                |row| {
                    Ok(SettingsRow {
                        default_work_start: row.get(0)?,
                        default_work_end: row.get(1)?,
                        lunch_start: row.get(2)?,
                        lunch_end: row.get(3)?,
                        updated_at_ms: row.get(4)?,
                    })
                },
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => SettingsRepositoryError::InvalidInput {
                    message: "settings row is missing".to_string(),
                },
                other => SettingsRepositoryError::from(other),
            })
    }

    pub fn update_default_work_times(
        connection: &Connection,
        start_time: &str,
        end_time: &str,
        updated_at_ms: i64,
    ) -> Result<SettingsRow, SettingsRepositoryError> {
        let updated = connection.execute(
            "UPDATE settings
             SET default_work_start = ?1, default_work_end = ?2, updated_at_ms = ?3
             WHERE id = 1",
            params![start_time, end_time, updated_at_ms],
        )?;
        if updated == 0 {
            return Err(SettingsRepositoryError::InvalidInput {
                message: "settings row is missing".to_string(),
            });
        }
        Self::get_settings(connection)
    }

    pub fn get_override(
        connection: &Connection,
        work_date: NaiveDate,
    ) -> Result<Option<DailyWorkOverride>, SettingsRepositoryError> {
        let work_date = format_work_date(work_date);
        connection
            .query_row(
                "SELECT work_date, start_time, end_time
                 FROM daily_work_overrides
                 WHERE work_date = ?1",
                [work_date.as_str()],
                |row| {
                    Ok(DailyWorkOverride {
                        work_date: row.get(0)?,
                        start_time: row.get(1)?,
                        end_time: row.get(2)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn upsert_override(
        connection: &Connection,
        work_date: NaiveDate,
        start_time: &str,
        end_time: &str,
    ) -> Result<DailyWorkOverride, SettingsRepositoryError> {
        let work_date = format_work_date(work_date);
        connection.execute(
            "INSERT INTO daily_work_overrides (work_date, start_time, end_time)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(work_date) DO UPDATE SET
                start_time = excluded.start_time,
                end_time = excluded.end_time",
            params![work_date, start_time, end_time],
        )?;

        Ok(DailyWorkOverride {
            work_date,
            start_time: start_time.to_string(),
            end_time: end_time.to_string(),
        })
    }

    pub fn delete_override(
        connection: &Connection,
        work_date: NaiveDate,
    ) -> Result<(), SettingsRepositoryError> {
        let work_date = format_work_date(work_date);
        connection.execute(
            "DELETE FROM daily_work_overrides WHERE work_date = ?1",
            [work_date.as_str()],
        )?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;

    struct TestDatabase {
        _temp: tempfile::TempDir,
        connection: Connection,
    }

    fn open_test_database() -> TestDatabase {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        TestDatabase {
            _temp: temp,
            connection,
        }
    }

    #[test]
    fn ensure_defaults_seeds_settings_row_once() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        SettingsRepository::ensure_defaults(&db.connection, 2).expect("seed again");

        let settings = SettingsRepository::get_settings(&db.connection).expect("settings");
        assert_eq!(settings.default_work_start, DEFAULT_WORK_START);
        assert_eq!(settings.default_work_end, DEFAULT_WORK_END);
        assert_eq!(settings.lunch_start, DEFAULT_LUNCH_START);
        assert_eq!(settings.lunch_end, DEFAULT_LUNCH_END);
    }

    #[test]
    fn override_round_trip_and_delete() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let day = NaiveDate::from_ymd_opt(2026, 8, 14).expect("date");

        SettingsRepository::upsert_override(&db.connection, day, "10:00", "20:00").expect("upsert");
        let loaded = SettingsRepository::get_override(&db.connection, day)
            .expect("get")
            .expect("override");
        assert_eq!(loaded.start_time, "10:00");
        assert_eq!(loaded.end_time, "20:00");

        SettingsRepository::delete_override(&db.connection, day).expect("delete");
        assert!(SettingsRepository::get_override(&db.connection, day)
            .expect("get")
            .is_none());
    }
}
