use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OvertimeRecord {
    pub id: String,
    pub work_date: String,
    pub start_at_ms: i64,
    pub end_at_ms: Option<i64>,
    pub auto_end_at_ms: i64,
    pub end_type: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateOvertimeRecordInput {
    pub id: String,
    pub work_date: String,
    pub start_at_ms: i64,
    pub auto_end_at_ms: i64,
}

#[derive(Debug)]
pub enum OvertimeRepositoryError {
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for OvertimeRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid overtime input: {message}")
            }
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for OvertimeRepositoryError {}

impl From<DbError> for OvertimeRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for OvertimeRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub struct OvertimeRepository;

impl OvertimeRepository {
    pub fn get_active_record(
        connection: &Connection,
    ) -> Result<Option<OvertimeRecord>, OvertimeRepositoryError> {
        connection
            .query_row(
                "SELECT id, work_date, start_at_ms, end_at_ms, auto_end_at_ms, end_type
                 FROM overtime_records
                 WHERE end_at_ms IS NULL
                 ORDER BY start_at_ms DESC
                 LIMIT 1",
                [],
                map_overtime_record,
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn has_manual_ended_overtime_for_work_date(
        connection: &Connection,
        work_date: &str,
    ) -> Result<bool, OvertimeRepositoryError> {
        let count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM overtime_records
             WHERE work_date = ?1
               AND end_at_ms IS NOT NULL
               AND end_type = 'manual'",
            [work_date],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn has_ended_overtime_for_work_date(
        connection: &Connection,
        work_date: &str,
    ) -> Result<bool, OvertimeRepositoryError> {
        let count: i64 = connection.query_row(
            "SELECT COUNT(*) FROM overtime_records
             WHERE work_date = ?1 AND end_at_ms IS NOT NULL",
            [work_date],
            |row| row.get(0),
        )?;
        Ok(count > 0)
    }

    pub fn insert_record(
        connection: &Connection,
        input: CreateOvertimeRecordInput,
    ) -> Result<OvertimeRecord, OvertimeRepositoryError> {
        connection.execute(
            "INSERT INTO overtime_records (
                id, work_date, start_at_ms, end_at_ms, auto_end_at_ms, end_type
             ) VALUES (?1, ?2, ?3, NULL, ?4, NULL)",
            params![
                input.id,
                input.work_date,
                input.start_at_ms,
                input.auto_end_at_ms,
            ],
        )?;

        Self::get_record_by_id(connection, &input.id)
    }

    pub fn end_active_record(
        connection: &Connection,
        end_at_ms: i64,
        end_type: &str,
    ) -> Result<Option<OvertimeRecord>, OvertimeRepositoryError> {
        let active = Self::get_active_record(connection)?;
        let Some(active) = active else {
            return Ok(None);
        };

        connection.execute(
            "UPDATE overtime_records
             SET end_at_ms = ?1, end_type = ?2
             WHERE id = ?3 AND end_at_ms IS NULL",
            params![end_at_ms, end_type, active.id],
        )?;

        Self::get_record_by_id(connection, &active.id).map(Some)
    }

    pub fn get_record_by_id(
        connection: &Connection,
        id: &str,
    ) -> Result<OvertimeRecord, OvertimeRepositoryError> {
        connection
            .query_row(
                "SELECT id, work_date, start_at_ms, end_at_ms, auto_end_at_ms, end_type
                 FROM overtime_records
                 WHERE id = ?1",
                [id],
                map_overtime_record,
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => OvertimeRepositoryError::InvalidInput {
                    message: format!("overtime record not found: {id}"),
                },
                other => OvertimeRepositoryError::from(other),
            })
    }
}

fn map_overtime_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<OvertimeRecord> {
    Ok(OvertimeRecord {
        id: row.get(0)?,
        work_date: row.get(1)?,
        start_at_ms: row.get(2)?,
        end_at_ms: row.get(3)?,
        auto_end_at_ms: row.get(4)?,
        end_type: row.get(5)?,
    })
}
