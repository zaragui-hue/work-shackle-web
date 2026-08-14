use rusqlite::{params, Connection};

use crate::db::connection::DbError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskReminder {
    pub id: String,
    pub task_id: String,
    pub remind_at_ms: i64,
    pub message: Option<String>,
    pub enabled: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateReminderInput {
    pub id: String,
    pub task_id: String,
    pub remind_at_ms: i64,
    pub message: Option<String>,
}

#[derive(Debug)]
pub enum ReminderRepositoryError {
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for ReminderRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid reminder input: {message}")
            }
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for ReminderRepositoryError {}

impl From<DbError> for ReminderRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for ReminderRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub struct ReminderRepository;

impl ReminderRepository {
    pub fn create(
        connection: &Connection,
        input: CreateReminderInput,
    ) -> Result<(), ReminderRepositoryError> {
        if input.remind_at_ms <= 0 {
            return Err(ReminderRepositoryError::InvalidInput {
                message: "reminder time must be positive".to_string(),
            });
        }

        connection.execute(
            "INSERT INTO task_reminders (id, task_id, remind_at_ms, message, enabled, fired_at_ms)
             VALUES (?1, ?2, ?3, ?4, 1, NULL)",
            params![input.id, input.task_id, input.remind_at_ms, input.message],
        )?;

        Ok(())
    }

    pub fn create_for_task(
        connection: &Connection,
        task_id: &str,
        reminders: &[CreateReminderInput],
    ) -> Result<(), ReminderRepositoryError> {
        for reminder in reminders {
            if reminder.task_id != task_id {
                return Err(ReminderRepositoryError::InvalidInput {
                    message: "reminder task_id mismatch".to_string(),
                });
            }
            Self::create(connection, reminder.clone())?;
        }
        Ok(())
    }

    pub fn list_for_task(
        connection: &Connection,
        task_id: &str,
    ) -> Result<Vec<TaskReminder>, ReminderRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT id, task_id, remind_at_ms, message, enabled
             FROM task_reminders
             WHERE task_id = ?1
             ORDER BY remind_at_ms ASC, id ASC",
        )?;
        let reminders = statement
            .query_map([task_id], map_reminder_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(reminders)
    }

    pub fn count_for_task(
        connection: &Connection,
        task_id: &str,
    ) -> Result<i64, ReminderRepositoryError> {
        connection
            .query_row(
                "SELECT COUNT(*) FROM task_reminders WHERE task_id = ?1",
                [task_id],
                |row| row.get(0),
            )
            .map_err(Into::into)
    }
}

fn map_reminder_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskReminder> {
    Ok(TaskReminder {
        id: row.get(0)?,
        task_id: row.get(1)?,
        remind_at_ms: row.get(2)?,
        message: row.get(3)?,
        enabled: row.get::<_, i32>(4)? == 1,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;

    fn seed_task(connection: &Connection, task_id: &str) {
        connection
            .execute(
                "INSERT INTO tasks (
                    id, title, planned_at_ms, priority, status, created_at_ms, updated_at_ms
                 ) VALUES (?1, 'Sample', 1000, 2, 'not_started', 1000, 1000)",
                [task_id],
            )
            .expect("insert task");
    }

    #[test]
    fn create_persists_enabled_reminder() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-1");

        ReminderRepository::create(
            &connection,
            CreateReminderInput {
                id: "rem-1".to_string(),
                task_id: "task-1".to_string(),
                remind_at_ms: 2_000,
                message: Some("check PRD".to_string()),
            },
        )
        .expect("create reminder");

        let (message, enabled): (Option<String>, i32) = connection
            .query_row(
                "SELECT message, enabled FROM task_reminders WHERE id = 'rem-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .expect("read reminder");

        assert_eq!(message.as_deref(), Some("check PRD"));
        assert_eq!(enabled, 1);
    }

    #[test]
    fn create_rejects_non_positive_remind_at() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-2");

        let error = ReminderRepository::create(
            &connection,
            CreateReminderInput {
                id: "rem-2".to_string(),
                task_id: "task-2".to_string(),
                remind_at_ms: 0,
                message: None,
            },
        )
        .expect_err("invalid remind_at");

        assert!(matches!(
            error,
            ReminderRepositoryError::InvalidInput { .. }
        ));
    }

    #[test]
    fn list_for_task_returns_reminders_in_time_order() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-3");

        ReminderRepository::create(
            &connection,
            CreateReminderInput {
                id: "rem-late".to_string(),
                task_id: "task-3".to_string(),
                remind_at_ms: 5_000,
                message: None,
            },
        )
        .expect("create late");
        ReminderRepository::create(
            &connection,
            CreateReminderInput {
                id: "rem-early".to_string(),
                task_id: "task-3".to_string(),
                remind_at_ms: 2_000,
                message: Some("early".to_string()),
            },
        )
        .expect("create early");

        let reminders = ReminderRepository::list_for_task(&connection, "task-3").expect("list");
        assert_eq!(reminders.len(), 2);
        assert_eq!(reminders[0].id, "rem-early");
        assert_eq!(reminders[1].id, "rem-late");
    }
}
