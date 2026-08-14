use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;
use crate::time::calendar_day::format_work_date;

use chrono::NaiveDate;

#[derive(Debug)]
pub enum LunchReminderRepositoryError {
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for LunchReminderRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid lunch reminder input: {message}")
            }
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for LunchReminderRepositoryError {}

impl From<DbError> for LunchReminderRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for LunchReminderRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub struct LunchReminderRepository;

impl LunchReminderRepository {
    pub fn has_fired_for_reminder_date(
        connection: &Connection,
        reminder_date: NaiveDate,
    ) -> Result<bool, LunchReminderRepositoryError> {
        let reminder_date = format_work_date(reminder_date);
        let fired_at_ms: Option<i64> = connection
            .query_row(
                "SELECT fired_at_ms FROM lunch_reminder_log WHERE reminder_date = ?1",
                [reminder_date.as_str()],
                |row| row.get(0),
            )
            .optional()?;
        Ok(fired_at_ms.is_some())
    }

    pub fn mark_fired(
        connection: &Connection,
        reminder_date: NaiveDate,
        fired_at_ms: i64,
    ) -> Result<(), LunchReminderRepositoryError> {
        if fired_at_ms <= 0 {
            return Err(LunchReminderRepositoryError::InvalidInput {
                message: "fired_at_ms must be positive".to_string(),
            });
        }

        let reminder_date = format_work_date(reminder_date);
        connection.execute(
            "INSERT INTO lunch_reminder_log (reminder_date, fired_at_ms)
             VALUES (?1, ?2)
             ON CONFLICT(reminder_date) DO NOTHING",
            params![reminder_date, fired_at_ms],
        )?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;

    #[test]
    fn mark_fired_is_idempotent_for_same_reminder_date() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        let day = NaiveDate::from_ymd_opt(2026, 8, 14).expect("date");

        LunchReminderRepository::mark_fired(&connection, day, 1_000).expect("first mark");
        LunchReminderRepository::mark_fired(&connection, day, 2_000).expect("second mark");

        assert!(
            LunchReminderRepository::has_fired_for_reminder_date(&connection, day)
                .expect("has fired")
        );

        let fired_at_ms: i64 = connection
            .query_row(
                "SELECT fired_at_ms FROM lunch_reminder_log WHERE reminder_date = '2026-08-14'",
                [],
                |row| row.get(0),
            )
            .expect("fired_at_ms");
        assert_eq!(fired_at_ms, 1_000);
    }
}
