use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;

pub const MAX_USER_REMINDERS: i32 = 3;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TaskReminder {
    pub id: String,
    pub task_id: String,
    pub remind_at_ms: i64,
    pub message: Option<String>,
    pub enabled: bool,
    pub fired_at_ms: Option<i64>,
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
    NotFound { id: String },
    LimitReached { limit: i32 },
    Db(DbError),
}

impl std::fmt::Display for ReminderRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid reminder input: {message}")
            }
            Self::NotFound { id } => write!(formatter, "reminder not found: {id}"),
            Self::LimitReached { limit } => {
                write!(formatter, "reminder limit reached: max {limit}")
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

        let existing_count = Self::count_for_task(connection, &input.task_id)?;
        if existing_count >= i64::from(MAX_USER_REMINDERS) {
            return Err(ReminderRepositoryError::LimitReached {
                limit: MAX_USER_REMINDERS,
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
        if reminders.len() as i32 > MAX_USER_REMINDERS {
            return Err(ReminderRepositoryError::LimitReached {
                limit: MAX_USER_REMINDERS,
            });
        }

        let existing_count = Self::count_for_task(connection, task_id)?;
        if existing_count + reminders.len() as i64 > i64::from(MAX_USER_REMINDERS) {
            return Err(ReminderRepositoryError::LimitReached {
                limit: MAX_USER_REMINDERS,
            });
        }

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
            "SELECT id, task_id, remind_at_ms, message, enabled, fired_at_ms
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

    pub fn get_by_id(
        connection: &Connection,
        id: &str,
    ) -> Result<TaskReminder, ReminderRepositoryError> {
        connection
            .query_row(
                "SELECT id, task_id, remind_at_ms, message, enabled, fired_at_ms
                 FROM task_reminders
                 WHERE id = ?1",
                [id],
                map_reminder_row,
            )
            .optional()?
            .ok_or_else(|| ReminderRepositoryError::NotFound { id: id.to_string() })
    }

    pub fn mark_fired(
        connection: &Connection,
        id: &str,
        fired_at_ms: i64,
    ) -> Result<TaskReminder, ReminderRepositoryError> {
        if fired_at_ms <= 0 {
            return Err(ReminderRepositoryError::InvalidInput {
                message: "fired_at_ms must be positive".to_string(),
            });
        }

        let existing = Self::get_by_id(connection, id)?;
        if existing.fired_at_ms.is_some() {
            return Ok(existing);
        }

        connection.execute(
            "UPDATE task_reminders
             SET fired_at_ms = ?1
             WHERE id = ?2 AND fired_at_ms IS NULL",
            params![fired_at_ms, id],
        )?;

        Self::get_by_id(connection, id)
    }

    pub fn list_due_for_engine(
        connection: &Connection,
        now_ms: i64,
        cutoff_ms: i64,
    ) -> Result<Vec<TaskReminder>, ReminderRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT r.id, r.task_id, r.remind_at_ms, r.message, r.enabled, r.fired_at_ms
             FROM task_reminders r
             INNER JOIN tasks t ON t.id = r.task_id
             WHERE r.enabled = 1
               AND r.fired_at_ms IS NULL
               AND t.status NOT IN ('completed', 'cancelled')
               AND r.remind_at_ms > ?1
               AND r.remind_at_ms <= ?2
             ORDER BY r.remind_at_ms ASC, r.id ASC",
        )?;
        let reminders = statement
            .query_map(params![cutoff_ms, now_ms], map_reminder_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(reminders)
    }

    pub fn count_unfired_at_or_before_cutoff(
        connection: &Connection,
        cutoff_ms: i64,
    ) -> Result<i64, ReminderRepositoryError> {
        connection
            .query_row(
                "SELECT COUNT(*)
                 FROM task_reminders r
                 INNER JOIN tasks t ON t.id = r.task_id
                 WHERE r.enabled = 1
                   AND r.fired_at_ms IS NULL
                   AND t.status NOT IN ('completed', 'cancelled')
                   AND r.remind_at_ms <= ?1",
                [cutoff_ms],
                |row| row.get(0),
            )
            .map_err(Into::into)
    }

    pub fn list_triggerable(
        connection: &Connection,
    ) -> Result<Vec<TaskReminder>, ReminderRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT r.id, r.task_id, r.remind_at_ms, r.message, r.enabled, r.fired_at_ms
             FROM task_reminders r
             INNER JOIN tasks t ON t.id = r.task_id
             WHERE r.enabled = 1
               AND r.fired_at_ms IS NULL
               AND t.status NOT IN ('completed', 'cancelled')
             ORDER BY r.remind_at_ms ASC, r.id ASC",
        )?;
        let reminders = statement
            .query_map([], map_reminder_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(reminders)
    }
}

fn map_reminder_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<TaskReminder> {
    Ok(TaskReminder {
        id: row.get(0)?,
        task_id: row.get(1)?,
        remind_at_ms: row.get(2)?,
        message: row.get(3)?,
        enabled: row.get::<_, i32>(4)? == 1,
        fired_at_ms: row.get(5)?,
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

        let (message, enabled, fired_at_ms): (Option<String>, i32, Option<i64>) = connection
            .query_row(
                "SELECT message, enabled, fired_at_ms FROM task_reminders WHERE id = 'rem-1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .expect("read reminder");

        assert_eq!(message.as_deref(), Some("check PRD"));
        assert_eq!(enabled, 1);
        assert!(fired_at_ms.is_none());
    }

    fn create_reminder(connection: &Connection, id: &str, task_id: &str, remind_at_ms: i64) {
        ReminderRepository::create(
            connection,
            CreateReminderInput {
                id: id.to_string(),
                task_id: task_id.to_string(),
                remind_at_ms,
                message: None,
            },
        )
        .expect("create reminder");
    }

    fn reminder_count(connection: &Connection, task_id: &str) -> i64 {
        ReminderRepository::count_for_task(connection, task_id).expect("count")
    }

    fn system_reminder_log_count(connection: &Connection) -> i64 {
        connection
            .query_row("SELECT COUNT(*) FROM system_reminder_log", [], |row| {
                row.get(0)
            })
            .expect("system reminder log count")
    }

    #[test]
    fn create_rejects_fourth_reminder_for_the_same_task() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-limit");

        create_reminder(&connection, "rem-a", "task-limit", 1_100);
        create_reminder(&connection, "rem-b", "task-limit", 1_200);
        create_reminder(&connection, "rem-c", "task-limit", 1_300);

        let error = ReminderRepository::create(
            &connection,
            CreateReminderInput {
                id: "rem-d".to_string(),
                task_id: "task-limit".to_string(),
                remind_at_ms: 1_400,
                message: None,
            },
        )
        .expect_err("fourth reminder");

        assert!(matches!(
            error,
            ReminderRepositoryError::LimitReached { limit: 3 }
        ));
        assert_eq!(reminder_count(&connection, "task-limit"), 3);
        assert_eq!(system_reminder_log_count(&connection), 0);
    }

    #[test]
    fn mark_fired_persists_fired_at_ms_and_is_idempotent() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-fire");
        create_reminder(&connection, "rem-fire", "task-fire", 2_000);

        let first = ReminderRepository::mark_fired(&connection, "rem-fire", 3_000)
            .expect("first mark fired");
        assert_eq!(first.fired_at_ms, Some(3_000));
        assert_eq!(reminder_count(&connection, "task-fire"), 1);

        let second = ReminderRepository::mark_fired(&connection, "rem-fire", 9_000)
            .expect("second mark fired");
        assert_eq!(second.fired_at_ms, Some(3_000));
        assert_eq!(reminder_count(&connection, "task-fire"), 1);
        assert_eq!(system_reminder_log_count(&connection), 0);
    }

    #[test]
    fn fired_at_ms_survives_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let first = initialize_database(temp.path()).expect("initialize database");
        seed_task(&first, "task-reopen");
        create_reminder(&first, "rem-reopen", "task-reopen", 2_000);
        ReminderRepository::mark_fired(&first, "rem-reopen", 4_000).expect("mark fired");
        drop(first);

        let reopened = initialize_database(temp.path()).expect("reopen database");
        let reminder =
            ReminderRepository::get_by_id(&reopened, "rem-reopen").expect("get reminder");
        assert_eq!(reminder.fired_at_ms, Some(4_000));
        assert_eq!(reminder_count(&reopened, "task-reopen"), 1);
        assert_eq!(system_reminder_log_count(&reopened), 0);
    }

    #[test]
    fn list_triggerable_excludes_terminal_tasks_and_already_fired_reminders() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-open");
        seed_task(&connection, "task-done");
        seed_task(&connection, "task-cancelled");
        create_reminder(&connection, "rem-open", "task-open", 2_000);
        create_reminder(&connection, "rem-fired", "task-open", 3_000);
        create_reminder(&connection, "rem-done", "task-done", 2_500);
        create_reminder(&connection, "rem-cancelled", "task-cancelled", 2_200);

        ReminderRepository::mark_fired(&connection, "rem-fired", 3_100).expect("mark fired");
        connection
            .execute(
                "UPDATE tasks SET status = 'completed', completed_at_ms = 4000 WHERE id = 'task-done'",
                [],
            )
            .expect("complete task");
        connection
            .execute(
                "UPDATE tasks SET status = 'cancelled', cancelled_at_ms = 4000 WHERE id = 'task-cancelled'",
                [],
            )
            .expect("cancel task");

        let triggerable = ReminderRepository::list_triggerable(&connection).expect("list");
        let ids: Vec<&str> = triggerable
            .iter()
            .map(|reminder| reminder.id.as_str())
            .collect();
        assert_eq!(ids, vec!["rem-open"]);
        assert_eq!(system_reminder_log_count(&connection), 0);
    }

    #[test]
    fn list_due_for_engine_excludes_cancelled_tasks_even_when_reminder_is_due() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-open");
        seed_task(&connection, "task-cancelled");
        create_reminder(&connection, "rem-open", "task-open", 12_000);
        create_reminder(&connection, "rem-cancelled", "task-cancelled", 15_000);
        connection
            .execute(
                "UPDATE tasks SET status = 'cancelled', cancelled_at_ms = 4000 WHERE id = 'task-cancelled'",
                [],
            )
            .expect("cancel task");

        let due =
            ReminderRepository::list_due_for_engine(&connection, 20_000, 10_000).expect("list");
        let ids: Vec<&str> = due.iter().map(|reminder| reminder.id.as_str()).collect();
        assert_eq!(ids, vec!["rem-open"]);
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
