use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkStatusRecord {
    pub id: String,
    pub work_date: String,
    pub status_type: String,
    pub display_copy: String,
    pub start_at_ms: i64,
    pub end_at_ms: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StatusCopyRow {
    pub id: String,
    pub status_type: String,
    pub content: String,
    pub is_active: bool,
    pub created_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateWorkStatusRecordInput {
    pub id: String,
    pub work_date: String,
    pub status_type: String,
    pub display_copy: String,
    pub start_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateStatusCopyInput {
    pub id: String,
    pub status_type: String,
    pub content: String,
    pub created_at_ms: i64,
}

#[derive(Debug)]
pub enum WorkStatusRepositoryError {
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for WorkStatusRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid work status input: {message}")
            }
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for WorkStatusRepositoryError {}

impl From<DbError> for WorkStatusRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for WorkStatusRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub struct WorkStatusRepository;

impl WorkStatusRepository {
    pub fn get_active_record(
        connection: &Connection,
    ) -> Result<Option<WorkStatusRecord>, WorkStatusRepositoryError> {
        connection
            .query_row(
                "SELECT id, work_date, status_type, display_copy, start_at_ms, end_at_ms
                 FROM work_status_records
                 WHERE end_at_ms IS NULL
                 ORDER BY start_at_ms DESC
                 LIMIT 1",
                [],
                map_work_status_record,
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn close_active_records(
        connection: &Connection,
        end_at_ms: i64,
    ) -> Result<(), WorkStatusRepositoryError> {
        connection.execute(
            "UPDATE work_status_records
             SET end_at_ms = ?1
             WHERE end_at_ms IS NULL",
            [end_at_ms],
        )?;
        Ok(())
    }

    pub fn close_active_records_for_status(
        connection: &Connection,
        status_type: &str,
        end_at_ms: i64,
    ) -> Result<(), WorkStatusRepositoryError> {
        connection.execute(
            "UPDATE work_status_records
             SET end_at_ms = ?1
             WHERE end_at_ms IS NULL AND status_type = ?2",
            params![end_at_ms, status_type],
        )?;
        Ok(())
    }

    pub fn insert_record(
        connection: &Connection,
        input: CreateWorkStatusRecordInput,
    ) -> Result<WorkStatusRecord, WorkStatusRepositoryError> {
        connection.execute(
            "INSERT INTO work_status_records (
                id, work_date, status_type, display_copy, start_at_ms, end_at_ms
             ) VALUES (?1, ?2, ?3, ?4, ?5, NULL)",
            params![
                input.id,
                input.work_date,
                input.status_type,
                input.display_copy,
                input.start_at_ms,
            ],
        )?;

        Self::get_record_by_id(connection, &input.id)
    }

    pub fn get_record_by_id(
        connection: &Connection,
        id: &str,
    ) -> Result<WorkStatusRecord, WorkStatusRepositoryError> {
        connection
            .query_row(
                "SELECT id, work_date, status_type, display_copy, start_at_ms, end_at_ms
                 FROM work_status_records
                 WHERE id = ?1",
                [id],
                map_work_status_record,
            )
            .map_err(|error| match error {
                rusqlite::Error::QueryReturnedNoRows => WorkStatusRepositoryError::InvalidInput {
                    message: format!("work status record not found: {id}"),
                },
                other => WorkStatusRepositoryError::from(other),
            })
    }

    pub fn list_copies_for_status(
        connection: &Connection,
        status_type: &str,
    ) -> Result<Vec<StatusCopyRow>, WorkStatusRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT id, status_type, content, is_active, created_at_ms
             FROM status_copies
             WHERE status_type = ?1 AND is_active = 1
             ORDER BY created_at_ms ASC, id ASC",
        )?;
        let rows = statement
            .query_map([status_type], map_status_copy)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    pub fn count_copies_for_status(
        connection: &Connection,
        status_type: &str,
    ) -> Result<i64, WorkStatusRepositoryError> {
        connection
            .query_row(
                "SELECT COUNT(*) FROM status_copies WHERE status_type = ?1",
                [status_type],
                |row| row.get(0),
            )
            .map_err(Into::into)
    }

    pub fn insert_copy(
        connection: &Connection,
        input: CreateStatusCopyInput,
    ) -> Result<StatusCopyRow, WorkStatusRepositoryError> {
        connection.execute(
            "INSERT INTO status_copies (id, status_type, content, is_active, created_at_ms)
             VALUES (?1, ?2, ?3, 1, ?4)",
            params![
                input.id,
                input.status_type,
                input.content,
                input.created_at_ms,
            ],
        )?;

        connection
            .query_row(
                "SELECT id, status_type, content, is_active, created_at_ms
                 FROM status_copies
                 WHERE id = ?1",
                [input.id.as_str()],
                map_status_copy,
            )
            .map_err(Into::into)
    }
}

fn map_work_status_record(row: &rusqlite::Row<'_>) -> rusqlite::Result<WorkStatusRecord> {
    Ok(WorkStatusRecord {
        id: row.get(0)?,
        work_date: row.get(1)?,
        status_type: row.get(2)?,
        display_copy: row.get(3)?,
        start_at_ms: row.get(4)?,
        end_at_ms: row.get(5)?,
    })
}

fn map_status_copy(row: &rusqlite::Row<'_>) -> rusqlite::Result<StatusCopyRow> {
    Ok(StatusCopyRow {
        id: row.get(0)?,
        status_type: row.get(1)?,
        content: row.get(2)?,
        is_active: row.get::<_, i64>(3)? == 1,
        created_at_ms: row.get(4)?,
    })
}
