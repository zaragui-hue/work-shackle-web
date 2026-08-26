use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;

const DEFAULT_PRIORITY: i32 = 2;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Task {
    pub id: String,
    pub title: String,
    pub note: Option<String>,
    pub planned_at_ms: i64,
    pub deadline_at_ms: Option<i64>,
    pub priority: i32,
    pub status: TaskStatus,
    pub contact_id: Option<String>,
    pub contact_snapshot: Option<String>,
    pub created_at_ms: i64,
    pub completed_at_ms: Option<i64>,
    pub cancelled_at_ms: Option<i64>,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TaskStatus {
    NotStarted,
    InProgress,
    Paused,
    Waiting,
    Completed,
    Cancelled,
}

impl TaskStatus {
    pub fn as_db_value(self) -> &'static str {
        match self {
            Self::NotStarted => "not_started",
            Self::InProgress => "in_progress",
            Self::Paused => "paused",
            Self::Waiting => "waiting",
            Self::Completed => "completed",
            Self::Cancelled => "cancelled",
        }
    }

    pub fn parse(value: &str) -> Result<Self, TaskRepositoryError> {
        match value {
            "not_started" => Ok(Self::NotStarted),
            "in_progress" => Ok(Self::InProgress),
            "paused" => Ok(Self::Paused),
            "waiting" => Ok(Self::Waiting),
            "completed" => Ok(Self::Completed),
            "cancelled" => Ok(Self::Cancelled),
            _ => Err(TaskRepositoryError::InvalidInput {
                message: format!("unsupported task status: {value}"),
            }),
        }
    }

    pub fn is_terminal(self) -> bool {
        matches!(self, Self::Completed | Self::Cancelled)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateTaskInput {
    pub id: String,
    pub title: String,
    pub note: Option<String>,
    pub planned_at_ms: i64,
    pub deadline_at_ms: Option<i64>,
    pub priority: Option<i32>,
    pub contact_id: Option<String>,
    pub contact_snapshot: Option<String>,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct UpdateTaskInput {
    pub title: Option<String>,
    pub note: Option<Option<String>>,
    pub planned_at_ms: Option<i64>,
    pub deadline_at_ms: Option<Option<i64>>,
    pub priority: Option<i32>,
    pub status: Option<TaskStatus>,
    pub contact_id: Option<Option<String>>,
    pub contact_snapshot: Option<Option<String>>,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct TaskQuery {
    pub status: Option<TaskStatus>,
    pub priority: Option<i32>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoryTaskQuery {
    pub start_ms: i64,
    pub end_ms: i64,
    pub status: Option<TaskStatus>,
    pub priority: Option<i32>,
    pub contact_id: Option<String>,
    pub contact_snapshot: Option<String>,
    pub keyword: Option<String>,
}

#[derive(Debug)]
pub enum TaskRepositoryError {
    NotFound { id: String },
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for TaskRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound { id } => write!(formatter, "task not found: {id}"),
            Self::InvalidInput { message } => write!(formatter, "invalid task input: {message}"),
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for TaskRepositoryError {}

impl From<DbError> for TaskRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for TaskRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CalendarCountCandidate {
    pub id: String,
    pub planned_at_ms: i64,
    pub deadline_at_ms: Option<i64>,
}

pub struct TaskRepository;

impl TaskRepository {
    pub fn create(
        connection: &Connection,
        input: CreateTaskInput,
    ) -> Result<Task, TaskRepositoryError> {
        validate_title(&input.title)?;
        let priority = input.priority.unwrap_or(DEFAULT_PRIORITY);
        validate_priority(priority)?;

        connection.execute(
            "INSERT INTO tasks (
                id, title, note, planned_at_ms, deadline_at_ms, priority, status,
                contact_id, contact_snapshot, created_at_ms, completed_at_ms,
                cancelled_at_ms, updated_at_ms
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, NULL, NULL, ?11)",
            params![
                input.id,
                input.title.trim(),
                input.note,
                input.planned_at_ms,
                input.deadline_at_ms,
                priority,
                TaskStatus::NotStarted.as_db_value(),
                input.contact_id,
                input.contact_snapshot,
                input.created_at_ms,
                input.updated_at_ms,
            ],
        )?;

        Self::get_by_id(connection, &input.id)
    }

    pub fn start_due_tasks(
        connection: &Connection,
        now_ms: i64,
    ) -> Result<Vec<String>, TaskRepositoryError> {
        let transaction = connection.unchecked_transaction()?;
        let ids = {
            let mut statement = transaction.prepare(
                "SELECT id
                 FROM tasks
                 WHERE status = 'not_started'
                   AND planned_at_ms <= ?1
                 ORDER BY id ASC",
            )?;
            let rows = statement
                .query_map([now_ms], |row| row.get::<_, String>(0))?
                .collect::<Result<Vec<_>, _>>()?;
            rows
        };

        if !ids.is_empty() {
            transaction.execute(
                "UPDATE tasks
                 SET status = 'in_progress', updated_at_ms = ?1
                 WHERE status = 'not_started'
                   AND planned_at_ms <= ?1",
                [now_ms],
            )?;
        }

        transaction.commit()?;
        Ok(ids)
    }

    pub fn update(
        connection: &Connection,
        id: &str,
        input: UpdateTaskInput,
    ) -> Result<Task, TaskRepositoryError> {
        let mut task = Self::get_by_id(connection, id)?;

        if let Some(title) = input.title {
            validate_title(&title)?;
            task.title = title.trim().to_string();
        }
        if let Some(note) = input.note {
            task.note = note;
        }
        if let Some(planned_at_ms) = input.planned_at_ms {
            task.planned_at_ms = planned_at_ms;
        }
        if let Some(deadline_at_ms) = input.deadline_at_ms {
            task.deadline_at_ms = deadline_at_ms;
        }
        if let Some(priority) = input.priority {
            validate_priority(priority)?;
            task.priority = priority;
        }
        if let Some(status) = input.status {
            task.status = status;
        }
        if let Some(contact_id) = input.contact_id {
            task.contact_id = contact_id;
        }
        if let Some(contact_snapshot) = input.contact_snapshot {
            task.contact_snapshot = contact_snapshot;
        }
        task.updated_at_ms = input.updated_at_ms;

        connection.execute(
            "UPDATE tasks
             SET title = ?1,
                 note = ?2,
                 planned_at_ms = ?3,
                 deadline_at_ms = ?4,
                 priority = ?5,
                 status = ?6,
                 contact_id = ?7,
                 contact_snapshot = ?8,
                 completed_at_ms = ?9,
                 cancelled_at_ms = ?10,
                 updated_at_ms = ?11
             WHERE id = ?12",
            params![
                task.title,
                task.note,
                task.planned_at_ms,
                task.deadline_at_ms,
                task.priority,
                task.status.as_db_value(),
                task.contact_id,
                task.contact_snapshot,
                task.completed_at_ms,
                task.cancelled_at_ms,
                task.updated_at_ms,
                task.id,
            ],
        )?;

        Ok(task)
    }

    pub fn get_by_id(connection: &Connection, id: &str) -> Result<Task, TaskRepositoryError> {
        connection
            .query_row(
                "SELECT id, title, note, planned_at_ms, deadline_at_ms, priority, status,
                        contact_id, contact_snapshot, created_at_ms, completed_at_ms,
                        cancelled_at_ms, updated_at_ms
                 FROM tasks
                 WHERE id = ?1",
                [id],
                map_task_row,
            )
            .optional()?
            .ok_or_else(|| TaskRepositoryError::NotFound { id: id.to_string() })
    }

    pub fn list_ddl_reminder_candidates(
        connection: &Connection,
    ) -> Result<Vec<Task>, TaskRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT id, title, note, planned_at_ms, deadline_at_ms, priority, status,
                    contact_id, contact_snapshot, created_at_ms, completed_at_ms,
                    cancelled_at_ms, updated_at_ms
             FROM tasks
             WHERE deadline_at_ms IS NOT NULL
               AND status NOT IN ('completed', 'cancelled')
             ORDER BY deadline_at_ms ASC, id ASC",
        )?;
        let tasks = statement
            .query_map([], map_task_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tasks)
    }

    pub fn list_calendar_count_candidates(
        connection: &Connection,
    ) -> Result<Vec<CalendarCountCandidate>, TaskRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT id, planned_at_ms, deadline_at_ms
             FROM tasks
             WHERE status NOT IN ('completed', 'cancelled')
             ORDER BY id ASC",
        )?;
        let candidates = statement
            .query_map([], |row| {
                Ok(CalendarCountCandidate {
                    id: row.get(0)?,
                    planned_at_ms: row.get(1)?,
                    deadline_at_ms: row.get(2)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(candidates)
    }

    pub fn query(
        connection: &Connection,
        query: TaskQuery,
    ) -> Result<Vec<Task>, TaskRepositoryError> {
        let mut sql = String::from(
            "SELECT id, title, note, planned_at_ms, deadline_at_ms, priority, status,
                    contact_id, contact_snapshot, created_at_ms, completed_at_ms,
                    cancelled_at_ms, updated_at_ms
             FROM tasks
             WHERE 1 = 1",
        );
        let mut bind_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        if let Some(status) = query.status {
            sql.push_str(" AND status = ?");
            bind_values.push(Box::new(status.as_db_value().to_string()));
        }
        if let Some(priority) = query.priority {
            sql.push_str(" AND priority = ?");
            bind_values.push(Box::new(priority));
        }

        sql.push_str(" ORDER BY updated_at_ms DESC, id ASC");

        let mut statement = connection.prepare(&sql)?;
        let params = rusqlite::params_from_iter(bind_values.iter().map(|value| value.as_ref()));
        let tasks = statement
            .query_map(params, map_task_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tasks)
    }

    pub fn query_history(
        connection: &Connection,
        query: HistoryTaskQuery,
    ) -> Result<Vec<Task>, TaskRepositoryError> {
        if query.start_ms >= query.end_ms {
            return Err(TaskRepositoryError::InvalidInput {
                message: "history range start must be before end".to_string(),
            });
        }

        if query
            .status
            .is_some_and(|status| !matches!(status, TaskStatus::Completed | TaskStatus::Cancelled))
        {
            return Ok(Vec::new());
        }

        let mut sql = String::from(
            "SELECT id, title, note, planned_at_ms, deadline_at_ms, priority, status,
                    contact_id, contact_snapshot, created_at_ms, completed_at_ms,
                    cancelled_at_ms, updated_at_ms
             FROM tasks
             WHERE ",
        );
        let mut bind_values: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();

        match query.status {
            Some(TaskStatus::Completed) => {
                sql.push_str(
                    "status = 'completed'
                     AND completed_at_ms IS NOT NULL
                     AND completed_at_ms >= ?
                     AND completed_at_ms < ?",
                );
                bind_values.push(Box::new(query.start_ms));
                bind_values.push(Box::new(query.end_ms));
            }
            Some(TaskStatus::Cancelled) => {
                sql.push_str(
                    "status = 'cancelled'
                     AND cancelled_at_ms IS NOT NULL
                     AND cancelled_at_ms >= ?
                     AND cancelled_at_ms < ?",
                );
                bind_values.push(Box::new(query.start_ms));
                bind_values.push(Box::new(query.end_ms));
            }
            None => {
                sql.push_str(
                    "(
                         (
                             status = 'completed'
                             AND completed_at_ms IS NOT NULL
                             AND completed_at_ms >= ?
                             AND completed_at_ms < ?
                         ) OR (
                             status = 'cancelled'
                             AND cancelled_at_ms IS NOT NULL
                             AND cancelled_at_ms >= ?
                             AND cancelled_at_ms < ?
                         )
                     )",
                );
                bind_values.push(Box::new(query.start_ms));
                bind_values.push(Box::new(query.end_ms));
                bind_values.push(Box::new(query.start_ms));
                bind_values.push(Box::new(query.end_ms));
            }
            Some(_) => unreachable!("non-terminal status filtered above"),
        }

        if let Some(priority) = query.priority {
            sql.push_str(" AND priority = ?");
            bind_values.push(Box::new(priority));
        }

        if query.contact_id.is_some() || query.contact_snapshot.is_some() {
            sql.push_str(" AND (contact_id = ? OR contact_snapshot = ?)");
            bind_values.push(Box::new(query.contact_id.clone()));
            bind_values.push(Box::new(query.contact_snapshot.clone()));
        }

        if let Some(keyword) = &query.keyword {
            let pattern = format!("%{}%", escape_like_pattern(keyword));
            sql.push_str(" AND (title LIKE ? ESCAPE '\\' OR IFNULL(note, '') LIKE ? ESCAPE '\\')");
            bind_values.push(Box::new(pattern.clone()));
            bind_values.push(Box::new(pattern));
        }

        sql.push_str(
            " ORDER BY
                 CASE
                     WHEN status = 'completed' THEN completed_at_ms
                     ELSE cancelled_at_ms
                 END DESC,
                 id ASC",
        );

        let mut statement = connection.prepare(&sql)?;
        let params = rusqlite::params_from_iter(bind_values.iter().map(|value| value.as_ref()));
        let tasks = statement
            .query_map(params, map_task_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(tasks)
    }

    pub fn complete(
        connection: &Connection,
        id: &str,
        completed_at_ms: i64,
    ) -> Result<Task, TaskRepositoryError> {
        let task = Self::get_by_id(connection, id)?;
        if task.status.is_terminal() {
            return Err(TaskRepositoryError::InvalidInput {
                message: format!(
                    "task {id} cannot be completed from status {}",
                    task.status.as_db_value()
                ),
            });
        }

        connection.execute(
            "UPDATE tasks
             SET status = ?1,
                 completed_at_ms = ?2,
                 cancelled_at_ms = NULL,
                 updated_at_ms = ?2
             WHERE id = ?3",
            params![TaskStatus::Completed.as_db_value(), completed_at_ms, id,],
        )?;

        Self::get_by_id(connection, id)
    }

    pub fn cancel(
        connection: &Connection,
        id: &str,
        cancelled_at_ms: i64,
    ) -> Result<Task, TaskRepositoryError> {
        let task = Self::get_by_id(connection, id)?;
        if task.status.is_terminal() {
            return Err(TaskRepositoryError::InvalidInput {
                message: format!(
                    "task {id} cannot be cancelled from status {}",
                    task.status.as_db_value()
                ),
            });
        }

        connection.execute(
            "UPDATE tasks
             SET status = ?1,
                 cancelled_at_ms = ?2,
                 completed_at_ms = NULL,
                 updated_at_ms = ?2
             WHERE id = ?3",
            params![TaskStatus::Cancelled.as_db_value(), cancelled_at_ms, id,],
        )?;

        Self::get_by_id(connection, id)
    }
}

fn map_task_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Task> {
    let status_value: String = row.get(6)?;
    Ok(Task {
        id: row.get(0)?,
        title: row.get(1)?,
        note: row.get(2)?,
        planned_at_ms: row.get(3)?,
        deadline_at_ms: row.get(4)?,
        priority: row.get(5)?,
        status: TaskStatus::parse(&status_value).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                6,
                rusqlite::types::Type::Text,
                Box::new(error),
            )
        })?,
        contact_id: row.get(7)?,
        contact_snapshot: row.get(8)?,
        created_at_ms: row.get(9)?,
        completed_at_ms: row.get(10)?,
        cancelled_at_ms: row.get(11)?,
        updated_at_ms: row.get(12)?,
    })
}

fn validate_title(title: &str) -> Result<(), TaskRepositoryError> {
    if title.trim().is_empty() {
        return Err(TaskRepositoryError::InvalidInput {
            message: "task title must not be empty".to_string(),
        });
    }
    Ok(())
}

fn validate_priority(priority: i32) -> Result<(), TaskRepositoryError> {
    if !(1..=5).contains(&priority) {
        return Err(TaskRepositoryError::InvalidInput {
            message: format!("task priority must be between 1 and 5, got {priority}"),
        });
    }
    Ok(())
}

fn escape_like_pattern(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
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

    fn sample_create_input(id: &str, title: &str, planned_at_ms: i64) -> CreateTaskInput {
        CreateTaskInput {
            id: id.to_string(),
            title: title.to_string(),
            note: Some("sample note".to_string()),
            planned_at_ms,
            deadline_at_ms: Some(planned_at_ms + 3_600_000),
            priority: None,
            contact_id: None,
            contact_snapshot: None,
            created_at_ms: planned_at_ms,
            updated_at_ms: planned_at_ms,
        }
    }

    #[test]
    fn start_due_tasks_only_updates_due_not_started_tasks() {
        let db = open_test_database();
        for (id, planned_at_ms) in [
            ("past", 1_000),
            ("boundary", 2_000),
            ("future", 3_000),
        ] {
            TaskRepository::create(
                &db.connection,
                sample_create_input(id, id, planned_at_ms),
            )
            .expect("create task");
        }

        let started =
            TaskRepository::start_due_tasks(&db.connection, 2_000).expect("start due tasks");

        assert_eq!(
            started,
            vec!["boundary".to_string(), "past".to_string()]
        );
        assert_eq!(
            TaskRepository::get_by_id(&db.connection, "past")
                .expect("past task")
                .status,
            TaskStatus::InProgress,
        );
        assert_eq!(
            TaskRepository::get_by_id(&db.connection, "future")
                .expect("future task")
                .status,
            TaskStatus::NotStarted,
        );
    }

    #[test]
    fn start_due_tasks_is_idempotent_and_preserves_manual_states() {
        let db = open_test_database();
        for id in ["paused", "waiting", "completed", "cancelled"] {
            TaskRepository::create(&db.connection, sample_create_input(id, id, 1_000))
                .expect("create task");
        }
        for (id, status) in [
            ("paused", TaskStatus::Paused),
            ("waiting", TaskStatus::Waiting),
            ("completed", TaskStatus::Completed),
            ("cancelled", TaskStatus::Cancelled),
        ] {
            TaskRepository::update(
                &db.connection,
                id,
                UpdateTaskInput {
                    status: Some(status),
                    updated_at_ms: 1_500,
                    ..Default::default()
                },
            )
            .expect("set manual state");
        }

        assert!(TaskRepository::start_due_tasks(&db.connection, 2_000)
            .expect("first reconcile")
            .is_empty());
        assert!(TaskRepository::start_due_tasks(&db.connection, 3_000)
            .expect("second reconcile")
            .is_empty());
    }

    #[test]
    fn create_persists_task_with_default_priority_and_status() {
        let db = open_test_database();
        let task = TaskRepository::create(
            &db.connection,
            sample_create_input("task-1", "Write report", 1_000),
        )
        .expect("create task");

        assert_eq!(task.id, "task-1");
        assert_eq!(task.title, "Write report");
        assert_eq!(task.priority, DEFAULT_PRIORITY);
        assert_eq!(task.status, TaskStatus::NotStarted);
        assert_eq!(task.note.as_deref(), Some("sample note"));
        assert_eq!(task.deadline_at_ms, Some(3_601_000));
        assert!(task.completed_at_ms.is_none());
        assert!(task.cancelled_at_ms.is_none());
    }

    #[test]
    fn create_rejects_empty_title() {
        let db = open_test_database();
        let error = TaskRepository::create(
            &db.connection,
            sample_create_input("task-empty", "   ", 1_000),
        )
        .expect_err("empty title must fail");

        assert!(matches!(error, TaskRepositoryError::InvalidInput { .. }));
    }

    #[test]
    fn create_rejects_invalid_priority() {
        let db = open_test_database();
        let mut input = sample_create_input("task-priority", "Priority test", 1_000);
        input.priority = Some(9);

        let error = TaskRepository::create(&db.connection, input).expect_err("invalid priority");
        assert!(matches!(error, TaskRepositoryError::InvalidInput { .. }));
    }

    #[test]
    fn get_by_id_returns_persisted_task() {
        let db = open_test_database();
        TaskRepository::create(
            &db.connection,
            sample_create_input("task-2", "Follow up", 2_000),
        )
        .expect("create task");

        let task = TaskRepository::get_by_id(&db.connection, "task-2").expect("get task");
        assert_eq!(task.title, "Follow up");
        assert_eq!(task.planned_at_ms, 2_000);
    }

    #[test]
    fn get_by_id_returns_not_found_for_missing_task() {
        let db = open_test_database();
        let error = TaskRepository::get_by_id(&db.connection, "missing")
            .expect_err("missing task must fail");

        assert!(matches!(error, TaskRepositoryError::NotFound { .. }));
    }

    #[test]
    fn update_changes_selected_fields() {
        let db = open_test_database();
        TaskRepository::create(
            &db.connection,
            sample_create_input("task-3", "Draft", 3_000),
        )
        .expect("create task");

        let updated = TaskRepository::update(
            &db.connection,
            "task-3",
            UpdateTaskInput {
                title: Some("Draft v2".to_string()),
                note: Some(Some("updated note".to_string())),
                priority: Some(4),
                status: Some(TaskStatus::InProgress),
                updated_at_ms: 3_500,
                ..Default::default()
            },
        )
        .expect("update task");

        assert_eq!(updated.title, "Draft v2");
        assert_eq!(updated.note.as_deref(), Some("updated note"));
        assert_eq!(updated.priority, 4);
        assert_eq!(updated.status, TaskStatus::InProgress);
        assert_eq!(updated.updated_at_ms, 3_500);
        assert_eq!(updated.planned_at_ms, 3_000);
    }

    #[test]
    fn query_filters_by_status_and_orders_by_updated_at_desc() {
        let db = open_test_database();
        TaskRepository::create(&db.connection, sample_create_input("task-a", "A", 1_000))
            .expect("create a");
        TaskRepository::create(&db.connection, sample_create_input("task-b", "B", 2_000))
            .expect("create b");
        TaskRepository::update(
            &db.connection,
            "task-b",
            UpdateTaskInput {
                status: Some(TaskStatus::InProgress),
                updated_at_ms: 9_000,
                ..Default::default()
            },
        )
        .expect("update b");

        let in_progress = TaskRepository::query(
            &db.connection,
            TaskQuery {
                status: Some(TaskStatus::InProgress),
                ..Default::default()
            },
        )
        .expect("query in progress");

        assert_eq!(in_progress.len(), 1);
        assert_eq!(in_progress[0].id, "task-b");

        let all = TaskRepository::query(&db.connection, TaskQuery::default()).expect("query all");
        assert_eq!(all.len(), 2);
        assert_eq!(all[0].id, "task-b");
        assert_eq!(all[1].id, "task-a");
    }

    #[test]
    fn complete_sets_completed_status_and_timestamp() {
        let db = open_test_database();
        TaskRepository::create(
            &db.connection,
            sample_create_input("task-complete", "Finish", 4_000),
        )
        .expect("create task");

        let completed = TaskRepository::complete(&db.connection, "task-complete", 4_500)
            .expect("complete task");

        assert_eq!(completed.status, TaskStatus::Completed);
        assert_eq!(completed.completed_at_ms, Some(4_500));
        assert!(completed.cancelled_at_ms.is_none());
        assert_eq!(completed.updated_at_ms, 4_500);
    }

    #[test]
    fn complete_rejects_terminal_task() {
        let db = open_test_database();
        TaskRepository::create(
            &db.connection,
            sample_create_input("task-done", "Done", 5_000),
        )
        .expect("create task");
        TaskRepository::complete(&db.connection, "task-done", 5_100).expect("complete once");

        let error = TaskRepository::complete(&db.connection, "task-done", 5_200)
            .expect_err("second complete must fail");
        assert!(matches!(error, TaskRepositoryError::InvalidInput { .. }));
    }

    #[test]
    fn cancel_sets_cancelled_status_and_timestamp() {
        let db = open_test_database();
        TaskRepository::create(
            &db.connection,
            sample_create_input("task-cancel", "Drop", 6_000),
        )
        .expect("create task");

        let cancelled =
            TaskRepository::cancel(&db.connection, "task-cancel", 6_500).expect("cancel task");

        assert_eq!(cancelled.status, TaskStatus::Cancelled);
        assert_eq!(cancelled.cancelled_at_ms, Some(6_500));
        assert!(cancelled.completed_at_ms.is_none());
        assert_eq!(cancelled.updated_at_ms, 6_500);
    }

    #[test]
    fn cancel_rejects_completed_task() {
        let db = open_test_database();
        TaskRepository::create(
            &db.connection,
            sample_create_input("task-finished", "Finished", 7_000),
        )
        .expect("create task");
        TaskRepository::complete(&db.connection, "task-finished", 7_100).expect("complete task");

        let error = TaskRepository::cancel(&db.connection, "task-finished", 7_200)
            .expect_err("cancel completed task must fail");
        assert!(matches!(error, TaskRepositoryError::InvalidInput { .. }));
    }

    #[test]
    fn query_history_filters_by_terminal_timestamps_only() {
        let db = open_test_database();
        TaskRepository::create(
            &db.connection,
            sample_create_input("active-task", "Active", 1_000_000),
        )
        .expect("create active");
        TaskRepository::create(
            &db.connection,
            sample_create_input("completed-in-range", "Done", 1_000_000),
        )
        .expect("create completed");
        TaskRepository::complete(&db.connection, "completed-in-range", 1_500_000)
            .expect("complete");
        TaskRepository::create(
            &db.connection,
            sample_create_input("completed-out-range", "Old done", 1_000_000),
        )
        .expect("create old completed");
        TaskRepository::complete(&db.connection, "completed-out-range", 500_000)
            .expect("complete old");
        TaskRepository::create(
            &db.connection,
            sample_create_input("cancelled-in-range", "Cancelled", 1_000_000),
        )
        .expect("create cancelled");
        TaskRepository::cancel(&db.connection, "cancelled-in-range", 1_600_000).expect("cancel");

        let tasks = TaskRepository::query_history(
            &db.connection,
            HistoryTaskQuery {
                start_ms: 1_400_000,
                end_ms: 1_700_000,
                status: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                keyword: None,
            },
        )
        .expect("query history");

        assert_eq!(
            tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["cancelled-in-range", "completed-in-range"]
        );
    }

    #[test]
    fn query_history_rejects_invalid_range() {
        let db = open_test_database();
        let error = TaskRepository::query_history(
            &db.connection,
            HistoryTaskQuery {
                start_ms: 2_000,
                end_ms: 2_000,
                status: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                keyword: None,
            },
        )
        .expect_err("invalid range");

        assert!(matches!(error, TaskRepositoryError::InvalidInput { .. }));
    }

    #[test]
    fn query_history_filters_by_status_and_priority() {
        let db = open_test_database();
        let mut completed_high = sample_create_input("completed-high", "High done", 1_000_000);
        completed_high.priority = Some(5);
        TaskRepository::create(&db.connection, completed_high).expect("create high");
        TaskRepository::complete(&db.connection, "completed-high", 1_500_000).expect("complete");

        let mut completed_low = sample_create_input("completed-low", "Low done", 1_000_000);
        completed_low.priority = Some(1);
        TaskRepository::create(&db.connection, completed_low).expect("create low");
        TaskRepository::complete(&db.connection, "completed-low", 1_550_000).expect("complete");

        TaskRepository::create(
            &db.connection,
            sample_create_input("cancelled-task", "Cancelled", 1_000_000),
        )
        .expect("create cancelled");
        TaskRepository::cancel(&db.connection, "cancelled-task", 1_600_000).expect("cancel");

        let completed_only = TaskRepository::query_history(
            &db.connection,
            HistoryTaskQuery {
                start_ms: 1_400_000,
                end_ms: 1_700_000,
                status: Some(TaskStatus::Completed),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                keyword: None,
            },
        )
        .expect("completed only");
        assert_eq!(completed_only.len(), 2);

        let high_only = TaskRepository::query_history(
            &db.connection,
            HistoryTaskQuery {
                start_ms: 1_400_000,
                end_ms: 1_700_000,
                status: None,
                priority: Some(5),
                contact_id: None,
                contact_snapshot: None,
                keyword: None,
            },
        )
        .expect("high only");
        assert_eq!(high_only.len(), 1);
        assert_eq!(high_only[0].id, "completed-high");
    }

    #[test]
    fn query_history_filters_by_contact_and_keyword() {
        let db = open_test_database();
        let mut alpha = sample_create_input("alpha", "Alpha report", 1_000_000);
        alpha.contact_snapshot = Some("Alpha".to_string());
        alpha.note = Some("weekly sync".to_string());
        TaskRepository::create(&db.connection, alpha).expect("create alpha");
        TaskRepository::complete(&db.connection, "alpha", 1_500_000).expect("complete alpha");

        let mut beta = sample_create_input("beta", "Beta draft", 1_000_000);
        beta.contact_snapshot = Some("Beta".to_string());
        beta.note = Some("other".to_string());
        TaskRepository::create(&db.connection, beta).expect("create beta");
        TaskRepository::complete(&db.connection, "beta", 1_550_000).expect("complete beta");

        let by_contact = TaskRepository::query_history(
            &db.connection,
            HistoryTaskQuery {
                start_ms: 1_400_000,
                end_ms: 1_700_000,
                status: None,
                priority: None,
                contact_id: None,
                contact_snapshot: Some("Alpha".to_string()),
                keyword: None,
            },
        )
        .expect("contact filter");
        assert_eq!(by_contact.len(), 1);
        assert_eq!(by_contact[0].id, "alpha");

        let by_keyword = TaskRepository::query_history(
            &db.connection,
            HistoryTaskQuery {
                start_ms: 1_400_000,
                end_ms: 1_700_000,
                status: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                keyword: Some("weekly".to_string()),
            },
        )
        .expect("keyword filter");
        assert_eq!(by_keyword.len(), 1);
        assert_eq!(by_keyword[0].id, "alpha");

        let by_title_keyword = TaskRepository::query_history(
            &db.connection,
            HistoryTaskQuery {
                start_ms: 1_400_000,
                end_ms: 1_700_000,
                status: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                keyword: Some("Beta".to_string()),
            },
        )
        .expect("title keyword");
        assert_eq!(by_title_keyword.len(), 1);
        assert_eq!(by_title_keyword[0].id, "beta");
    }

    #[test]
    fn query_history_non_terminal_status_returns_empty_without_error() {
        let db = open_test_database();
        TaskRepository::create(
            &db.connection,
            sample_create_input("completed-task", "Done", 1_000_000),
        )
        .expect("create");
        TaskRepository::complete(&db.connection, "completed-task", 1_500_000).expect("complete");

        let tasks = TaskRepository::query_history(
            &db.connection,
            HistoryTaskQuery {
                start_ms: 1_400_000,
                end_ms: 1_700_000,
                status: Some(TaskStatus::InProgress),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                keyword: None,
            },
        )
        .expect("empty for in progress");

        assert!(tasks.is_empty());
    }
}
