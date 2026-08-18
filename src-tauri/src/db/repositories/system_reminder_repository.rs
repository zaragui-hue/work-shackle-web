use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;

pub const DDL_60_OFFSET_MS: i64 = 60 * 60 * 1000;
pub const DDL_30_OFFSET_MS: i64 = 30 * 60 * 1000;
pub const DDL_10_OFFSET_MS: i64 = 10 * 60 * 1000;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SystemReminderKind {
    Ddl60,
    Ddl30,
    Ddl10,
    DdlDue,
}

impl SystemReminderKind {
    pub const ALL: [Self; 4] = [Self::Ddl60, Self::Ddl30, Self::Ddl10, Self::DdlDue];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ddl60 => "ddl_60",
            Self::Ddl30 => "ddl_30",
            Self::Ddl10 => "ddl_10",
            Self::DdlDue => "ddl_due",
        }
    }

    pub fn offset_ms(self) -> i64 {
        match self {
            Self::Ddl60 => DDL_60_OFFSET_MS,
            Self::Ddl30 => DDL_30_OFFSET_MS,
            Self::Ddl10 => DDL_10_OFFSET_MS,
            Self::DdlDue => 0,
        }
    }

    pub fn trigger_at_ms(self, deadline_at_ms: i64) -> i64 {
        deadline_at_ms - self.offset_ms()
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "ddl_60" => Some(Self::Ddl60),
            "ddl_30" => Some(Self::Ddl30),
            "ddl_10" => Some(Self::Ddl10),
            "ddl_due" => Some(Self::DdlDue),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SystemReminderNode {
    pub kind: SystemReminderKind,
    pub trigger_at_ms: i64,
    pub deadline_snapshot_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SystemReminderLogEntry {
    pub id: String,
    pub task_id: String,
    pub deadline_snapshot_ms: i64,
    pub kind: SystemReminderKind,
    pub scheduled_at_ms: i64,
    pub fired_at_ms: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct MarkSystemReminderFiredInput {
    pub id: String,
    pub task_id: String,
    pub kind: SystemReminderKind,
    pub deadline_snapshot_ms: i64,
    pub fired_at_ms: i64,
}

#[derive(Debug)]
pub enum SystemReminderRepositoryError {
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for SystemReminderRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid system reminder input: {message}")
            }
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for SystemReminderRepositoryError {}

impl From<DbError> for SystemReminderRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for SystemReminderRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub fn compute_nodes(
    deadline_at_ms: i64,
) -> Result<Vec<SystemReminderNode>, SystemReminderRepositoryError> {
    if deadline_at_ms <= 0 {
        return Err(SystemReminderRepositoryError::InvalidInput {
            message: "deadline must be positive".to_string(),
        });
    }

    Ok(SystemReminderKind::ALL
        .into_iter()
        .map(|kind| SystemReminderNode {
            trigger_at_ms: kind.trigger_at_ms(deadline_at_ms),
            deadline_snapshot_ms: deadline_at_ms,
            kind,
        })
        .collect())
}

pub struct SystemReminderRepository;

impl SystemReminderRepository {
    pub fn has_fired(
        connection: &Connection,
        task_id: &str,
        kind: SystemReminderKind,
        deadline_snapshot_ms: i64,
    ) -> Result<bool, SystemReminderRepositoryError> {
        let fired_at_ms: Option<i64> = connection
            .query_row(
                "SELECT fired_at_ms
                 FROM system_reminder_log
                 WHERE task_id = ?1 AND kind = ?2 AND deadline_snapshot_ms = ?3",
                params![task_id, kind.as_str(), deadline_snapshot_ms],
                |row| row.get(0),
            )
            .optional()?;
        Ok(fired_at_ms.is_some())
    }

    pub fn get_entry(
        connection: &Connection,
        task_id: &str,
        kind: SystemReminderKind,
        deadline_snapshot_ms: i64,
    ) -> Result<Option<SystemReminderLogEntry>, SystemReminderRepositoryError> {
        connection
            .query_row(
                "SELECT id, task_id, deadline_snapshot_ms, kind, scheduled_at_ms, fired_at_ms
                 FROM system_reminder_log
                 WHERE task_id = ?1 AND kind = ?2 AND deadline_snapshot_ms = ?3",
                params![task_id, kind.as_str(), deadline_snapshot_ms],
                map_system_reminder_row,
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn mark_fired(
        connection: &Connection,
        input: MarkSystemReminderFiredInput,
    ) -> Result<SystemReminderLogEntry, SystemReminderRepositoryError> {
        if input.deadline_snapshot_ms <= 0 || input.fired_at_ms <= 0 {
            return Err(SystemReminderRepositoryError::InvalidInput {
                message: "deadline snapshot and fired_at_ms must be positive".to_string(),
            });
        }

        let scheduled_at_ms = input.kind.trigger_at_ms(input.deadline_snapshot_ms);

        connection.execute(
            "INSERT INTO system_reminder_log (
                id, task_id, deadline_snapshot_ms, kind, scheduled_at_ms, fired_at_ms
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)
             ON CONFLICT(task_id, kind, deadline_snapshot_ms) DO NOTHING",
            params![
                input.id,
                input.task_id,
                input.deadline_snapshot_ms,
                input.kind.as_str(),
                scheduled_at_ms,
                input.fired_at_ms,
            ],
        )?;

        Self::get_entry(
            connection,
            &input.task_id,
            input.kind,
            input.deadline_snapshot_ms,
        )?
        .ok_or_else(|| SystemReminderRepositoryError::InvalidInput {
            message: "system reminder log entry missing after insert".to_string(),
        })
    }

    pub fn count_for_task(
        connection: &Connection,
        task_id: &str,
    ) -> Result<i64, SystemReminderRepositoryError> {
        connection
            .query_row(
                "SELECT COUNT(*) FROM system_reminder_log WHERE task_id = ?1",
                [task_id],
                |row| row.get(0),
            )
            .map_err(Into::into)
    }
}

fn map_system_reminder_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<SystemReminderLogEntry> {
    let kind = row.get::<_, String>(3)?;
    Ok(SystemReminderLogEntry {
        id: row.get(0)?,
        task_id: row.get(1)?,
        deadline_snapshot_ms: row.get(2)?,
        kind: SystemReminderKind::from_str(&kind).ok_or_else(|| {
            rusqlite::Error::InvalidColumnType(3, "kind".to_string(), rusqlite::types::Type::Text)
        })?,
        scheduled_at_ms: row.get(4)?,
        fired_at_ms: row.get(5)?,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::id::new_entity_id;

    fn seed_task(connection: &Connection, task_id: &str, deadline_at_ms: i64) {
        connection
            .execute(
                "INSERT INTO tasks (
                    id, title, planned_at_ms, deadline_at_ms, priority, status,
                    created_at_ms, updated_at_ms
                 ) VALUES (?1, 'Sample', 1000, ?2, 2, 'not_started', 1000, 1000)",
                params![task_id, deadline_at_ms],
            )
            .expect("insert task");
    }

    fn mark(
        connection: &Connection,
        task_id: &str,
        kind: SystemReminderKind,
        deadline_snapshot_ms: i64,
        fired_at_ms: i64,
    ) -> SystemReminderLogEntry {
        SystemReminderRepository::mark_fired(
            connection,
            MarkSystemReminderFiredInput {
                id: new_entity_id("system-reminder"),
                task_id: task_id.to_string(),
                kind,
                deadline_snapshot_ms,
                fired_at_ms,
            },
        )
        .expect("mark fired")
    }

    #[test]
    fn compute_nodes_sets_expected_trigger_times() {
        let deadline_at_ms = 10_800_000;
        let nodes = compute_nodes(deadline_at_ms).expect("compute nodes");

        assert_eq!(nodes.len(), 4);
        assert_eq!(nodes[0].kind, SystemReminderKind::Ddl60);
        assert_eq!(nodes[0].trigger_at_ms, 7_200_000);
        assert_eq!(nodes[1].kind, SystemReminderKind::Ddl30);
        assert_eq!(nodes[1].trigger_at_ms, 9_000_000);
        assert_eq!(nodes[2].kind, SystemReminderKind::Ddl10);
        assert_eq!(nodes[2].trigger_at_ms, 10_200_000);
        assert_eq!(nodes[3].kind, SystemReminderKind::DdlDue);
        assert_eq!(nodes[3].trigger_at_ms, deadline_at_ms);
        assert!(nodes
            .iter()
            .all(|node| node.deadline_snapshot_ms == deadline_at_ms));
    }

    #[test]
    fn mark_fired_is_idempotent_for_same_task_kind_and_deadline_snapshot() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-1", 10_800_000);

        let first = mark(
            &connection,
            "task-1",
            SystemReminderKind::Ddl60,
            10_800_000,
            7_200_000,
        );
        let second = mark(
            &connection,
            "task-1",
            SystemReminderKind::Ddl60,
            10_800_000,
            9_999_999,
        );

        assert_eq!(first.id, second.id);
        assert_eq!(second.fired_at_ms, Some(7_200_000));
        assert_eq!(
            SystemReminderRepository::count_for_task(&connection, "task-1").expect("count"),
            1
        );
    }

    #[test]
    fn different_deadline_snapshots_can_both_be_recorded() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-1", 20_000);

        mark(
            &connection,
            "task-1",
            SystemReminderKind::Ddl60,
            18_000,
            16_200_000,
        );
        mark(
            &connection,
            "task-1",
            SystemReminderKind::Ddl60,
            20_000,
            18_200_000,
        );

        assert!(SystemReminderRepository::has_fired(
            &connection,
            "task-1",
            SystemReminderKind::Ddl60,
            18_000
        )
        .expect("old snapshot fired"));
        assert!(SystemReminderRepository::has_fired(
            &connection,
            "task-1",
            SystemReminderKind::Ddl60,
            20_000
        )
        .expect("new snapshot fired"));
        assert_eq!(
            SystemReminderRepository::count_for_task(&connection, "task-1").expect("count"),
            2
        );
    }

    #[test]
    fn fired_fact_survives_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();

        {
            let connection = initialize_database(workspace).expect("initialize database");
            seed_task(&connection, "task-reopen", 10_800_000);
            mark(
                &connection,
                "task-reopen",
                SystemReminderKind::Ddl30,
                10_800_000,
                9_000_000,
            );
        }

        let reopened = initialize_database(workspace).expect("reopen database");
        let entry = SystemReminderRepository::get_entry(
            &reopened,
            "task-reopen",
            SystemReminderKind::Ddl30,
            10_800_000,
        )
        .expect("get entry")
        .expect("entry exists");

        assert_eq!(entry.fired_at_ms, Some(9_000_000));
        assert_eq!(entry.scheduled_at_ms, 9_000_000);
    }
}
