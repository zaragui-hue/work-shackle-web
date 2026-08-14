use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;
use crate::time::calendar_day::format_work_date;

use chrono::NaiveDate;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkEndDecisionRow {
    pub work_date: String,
    pub decision: String,
    pub display_copy: String,
    pub decided_at_ms: i64,
}

#[derive(Debug)]
pub enum WorkEndDecisionRepositoryError {
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for WorkEndDecisionRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid work end decision input: {message}")
            }
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for WorkEndDecisionRepositoryError {}

impl From<DbError> for WorkEndDecisionRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for WorkEndDecisionRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub struct WorkEndDecisionRepository;

impl WorkEndDecisionRepository {
    pub fn get_for_work_date(
        connection: &Connection,
        work_date: NaiveDate,
    ) -> Result<Option<WorkEndDecisionRow>, WorkEndDecisionRepositoryError> {
        let work_date = format_work_date(work_date);
        connection
            .query_row(
                "SELECT work_date, decision, display_copy, decided_at_ms
                 FROM work_end_decisions
                 WHERE work_date = ?1",
                [work_date.as_str()],
                |row| {
                    Ok(WorkEndDecisionRow {
                        work_date: row.get(0)?,
                        decision: row.get(1)?,
                        display_copy: row.get(2)?,
                        decided_at_ms: row.get(3)?,
                    })
                },
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn insert_normal_off(
        connection: &Connection,
        work_date: NaiveDate,
        display_copy: &str,
        decided_at_ms: i64,
    ) -> Result<(), WorkEndDecisionRepositoryError> {
        if display_copy.trim().is_empty() {
            return Err(WorkEndDecisionRepositoryError::InvalidInput {
                message: "display_copy must not be empty".to_string(),
            });
        }
        if decided_at_ms <= 0 {
            return Err(WorkEndDecisionRepositoryError::InvalidInput {
                message: "decided_at_ms must be positive".to_string(),
            });
        }

        let work_date = format_work_date(work_date);
        connection.execute(
            "INSERT INTO work_end_decisions
             (work_date, decision, display_copy, decided_at_ms)
             VALUES (?1, 'normal_off', ?2, ?3)
             ON CONFLICT(work_date) DO NOTHING",
            params![work_date, display_copy, decided_at_ms],
        )?;

        Ok(())
    }
}

pub fn has_active_overtime(connection: &Connection) -> Result<bool, DbError> {
    let count: i64 = connection.query_row(
        "SELECT COUNT(*) FROM overtime_records WHERE end_at_ms IS NULL",
        [],
        |row| row.get(0),
    )?;
    Ok(count > 0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;

    #[test]
    fn insert_normal_off_is_idempotent_for_same_work_date() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        let day = NaiveDate::from_ymd_opt(2026, 8, 14).expect("date");

        WorkEndDecisionRepository::insert_normal_off(&connection, day, "first copy", 1_000)
            .expect("first insert");
        WorkEndDecisionRepository::insert_normal_off(&connection, day, "second copy", 2_000)
            .expect("second insert");

        let row = WorkEndDecisionRepository::get_for_work_date(&connection, day)
            .expect("get")
            .expect("row");
        assert_eq!(row.display_copy, "first copy");
        assert_eq!(row.decided_at_ms, 1_000);
    }
}
