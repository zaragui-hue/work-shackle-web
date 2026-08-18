use rusqlite::{params, Connection};

use crate::db::connection::DbError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Postponement {
    pub id: String,
    pub task_id: String,
    pub old_deadline_at_ms: i64,
    pub new_deadline_at_ms: i64,
    pub reason: String,
    pub created_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreatePostponementInput {
    pub id: String,
    pub task_id: String,
    pub old_deadline_at_ms: i64,
    pub new_deadline_at_ms: i64,
    pub reason: String,
    pub created_at_ms: i64,
}

#[derive(Debug)]
pub enum PostponementRepositoryError {
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for PostponementRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid postponement input: {message}")
            }
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for PostponementRepositoryError {}

impl From<DbError> for PostponementRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for PostponementRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub struct PostponementRepository;

impl PostponementRepository {
    pub fn create(
        connection: &Connection,
        input: CreatePostponementInput,
    ) -> Result<Postponement, PostponementRepositoryError> {
        validate_reason(&input.reason)?;
        if input.old_deadline_at_ms <= 0 || input.new_deadline_at_ms <= 0 {
            return Err(PostponementRepositoryError::InvalidInput {
                message: "deadline timestamps must be positive".to_string(),
            });
        }

        connection.execute(
            "INSERT INTO task_postponements (
                id, task_id, old_deadline_at_ms, new_deadline_at_ms, reason, created_at_ms
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                input.id,
                input.task_id,
                input.old_deadline_at_ms,
                input.new_deadline_at_ms,
                input.reason.trim(),
                input.created_at_ms,
            ],
        )?;

        connection
            .query_row(
                "SELECT id, task_id, old_deadline_at_ms, new_deadline_at_ms, reason, created_at_ms
                 FROM task_postponements
                 WHERE id = ?1",
                [input.id],
                map_postponement_row,
            )
            .map_err(Into::into)
    }

    pub fn list_for_task(
        connection: &Connection,
        task_id: &str,
    ) -> Result<Vec<Postponement>, PostponementRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT id, task_id, old_deadline_at_ms, new_deadline_at_ms, reason, created_at_ms
             FROM task_postponements
             WHERE task_id = ?1
             ORDER BY created_at_ms ASC, rowid ASC",
        )?;
        let rows = statement
            .query_map([task_id], map_postponement_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rows)
    }
}

fn map_postponement_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Postponement> {
    Ok(Postponement {
        id: row.get(0)?,
        task_id: row.get(1)?,
        old_deadline_at_ms: row.get(2)?,
        new_deadline_at_ms: row.get(3)?,
        reason: row.get(4)?,
        created_at_ms: row.get(5)?,
    })
}

fn validate_reason(reason: &str) -> Result<(), PostponementRepositoryError> {
    if reason.trim().is_empty() {
        return Err(PostponementRepositoryError::InvalidInput {
            message: "postponement reason must not be empty".to_string(),
        });
    }
    Ok(())
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

    fn seed_task(connection: &Connection, task_id: &str, deadline_at_ms: i64) {
        connection
            .execute(
                "INSERT INTO tasks (
                    id, title, planned_at_ms, deadline_at_ms, priority, status,
                    created_at_ms, updated_at_ms
                 ) VALUES (?1, 'Task', 1000, ?2, 2, 'not_started', 1000, 1000)",
                params![task_id, deadline_at_ms],
            )
            .expect("insert task");
    }

    #[test]
    fn create_appends_postponement_record() {
        let db = open_test_database();
        seed_task(&db.connection, "task-1", 5_000);

        let record = PostponementRepository::create(
            &db.connection,
            CreatePostponementInput {
                id: "post-1".to_string(),
                task_id: "task-1".to_string(),
                old_deadline_at_ms: 5_000,
                new_deadline_at_ms: 8_000,
                reason: "研发接口没给".to_string(),
                created_at_ms: 6_000,
            },
        )
        .expect("create postponement");

        assert_eq!(record.reason, "研发接口没给");
        let listed = PostponementRepository::list_for_task(&db.connection, "task-1").expect("list");
        assert_eq!(listed.len(), 1);
    }

    #[test]
    fn list_preserves_append_only_history_order() {
        let db = open_test_database();
        seed_task(&db.connection, "task-2", 5_000);

        PostponementRepository::create(
            &db.connection,
            CreatePostponementInput {
                id: "post-a".to_string(),
                task_id: "task-2".to_string(),
                old_deadline_at_ms: 5_000,
                new_deadline_at_ms: 8_000,
                reason: "first".to_string(),
                created_at_ms: 6_000,
            },
        )
        .expect("first");
        PostponementRepository::create(
            &db.connection,
            CreatePostponementInput {
                id: "post-b".to_string(),
                task_id: "task-2".to_string(),
                old_deadline_at_ms: 8_000,
                new_deadline_at_ms: 10_000,
                reason: "second".to_string(),
                created_at_ms: 9_000,
            },
        )
        .expect("second");

        let listed = PostponementRepository::list_for_task(&db.connection, "task-2").expect("list");
        assert_eq!(listed.len(), 2);
        assert_eq!(listed[0].id, "post-a");
        assert_eq!(listed[1].id, "post-b");
    }

    #[test]
    fn create_rejects_empty_reason() {
        let db = open_test_database();
        seed_task(&db.connection, "task-3", 5_000);

        let error = PostponementRepository::create(
            &db.connection,
            CreatePostponementInput {
                id: "post-empty".to_string(),
                task_id: "task-3".to_string(),
                old_deadline_at_ms: 5_000,
                new_deadline_at_ms: 8_000,
                reason: "   ".to_string(),
                created_at_ms: 6_000,
            },
        )
        .expect_err("empty reason");

        assert!(matches!(
            error,
            PostponementRepositoryError::InvalidInput { .. }
        ));
    }
}
