use std::io;
use std::time::{SystemTime, UNIX_EPOCH};

use rusqlite::Connection;

use crate::db::connection::DbError;
use crate::db::repositories::tasks as task_repository;
use crate::models::task::Task;

pub const SMOKE_TASK_ID: &str = "smoke-persistence-task";

pub fn create_smoke_task(connection: &Connection) -> Result<Task, DbError> {
    let now = epoch_milliseconds()?;
    let task = Task {
        id: SMOKE_TASK_ID.to_string(),
        title: "Smoke Test Task".to_string(),
        note: Some("Phase 1 persistence smoke test".to_string()),
        planned_at_ms: now,
        deadline_at_ms: None,
        priority: 2,
        status: "not_started".to_string(),
        contact_id: None,
        contact_snapshot: None,
        created_at_ms: now,
        completed_at_ms: None,
        cancelled_at_ms: None,
        updated_at_ms: now,
    };

    connection.execute("DELETE FROM tasks WHERE id = ?1", [SMOKE_TASK_ID])?;
    task_repository::create(connection, &task)?;
    Ok(task)
}

pub fn get_task_by_id(connection: &Connection, id: &str) -> Result<Task, DbError> {
    task_repository::get_by_id(connection, id)?.ok_or_else(|| {
        DbError::Sqlite(rusqlite::Error::QueryReturnedNoRows)
    })
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
