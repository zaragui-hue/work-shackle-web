use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;
use crate::models::task::Task;

pub fn create(connection: &Connection, task: &Task) -> Result<(), DbError> {
    connection.execute(
        "INSERT INTO tasks (
            id, title, note, planned_at_ms, deadline_at_ms, priority, status,
            contact_id, contact_snapshot, created_at_ms, completed_at_ms,
            cancelled_at_ms, updated_at_ms
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
        params![
            task.id,
            task.title,
            task.note,
            task.planned_at_ms,
            task.deadline_at_ms,
            task.priority,
            task.status,
            task.contact_id,
            task.contact_snapshot,
            task.created_at_ms,
            task.completed_at_ms,
            task.cancelled_at_ms,
            task.updated_at_ms,
        ],
    )?;
    Ok(())
}

pub fn get_by_id(connection: &Connection, id: &str) -> Result<Option<Task>, DbError> {
    connection
        .query_row(
            "SELECT
                id, title, note, planned_at_ms, deadline_at_ms, priority, status,
                contact_id, contact_snapshot, created_at_ms, completed_at_ms,
                cancelled_at_ms, updated_at_ms
             FROM tasks
             WHERE id = ?1",
            [id],
            map_task_row,
        )
        .optional()
        .map_err(DbError::from)
}

fn map_task_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        note: row.get(2)?,
        planned_at_ms: row.get(3)?,
        deadline_at_ms: row.get(4)?,
        priority: row.get(5)?,
        status: row.get(6)?,
        contact_id: row.get(7)?,
        contact_snapshot: row.get(8)?,
        created_at_ms: row.get(9)?,
        completed_at_ms: row.get(10)?,
        cancelled_at_ms: row.get(11)?,
        updated_at_ms: row.get(12)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::services::task_service::{create_smoke_task, SMOKE_TASK_ID};

    #[test]
    fn task_persists_across_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        let created = create_smoke_task(&connection).expect("create smoke task");
        drop(connection);

        let reopened = initialize_database(temp.path()).expect("reopen database");
        let loaded = get_by_id(&reopened, SMOKE_TASK_ID)
            .expect("query task")
            .expect("task should persist");

        assert_eq!(loaded, created);
    }
}
