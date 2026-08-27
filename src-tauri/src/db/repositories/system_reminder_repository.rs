use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;

pub const MINUTE_MS: i64 = 60 * 1000;
pub const ONE_HOUR_MS: i64 = 60 * MINUTE_MS;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SystemReminderKind {
    ProgressHalf,
    QuarterRemaining,
    OneHourRemaining,
    DdlDue,
}

impl SystemReminderKind {
    pub const ALL: [Self; 4] = [
        Self::ProgressHalf,
        Self::QuarterRemaining,
        Self::OneHourRemaining,
        Self::DdlDue,
    ];

    pub fn as_str(self) -> &'static str {
        match self {
            Self::ProgressHalf => "progress_half",
            Self::QuarterRemaining => "quarter_remaining",
            Self::OneHourRemaining => "one_hour_remaining",
            Self::DdlDue => "ddl_due",
        }
    }

    pub fn urgency(self) -> u8 {
        match self {
            Self::ProgressHalf => 1,
            Self::QuarterRemaining => 2,
            Self::OneHourRemaining => 3,
            Self::DdlDue => 4,
        }
    }

    pub fn from_str(value: &str) -> Option<Self> {
        match value {
            "progress_half" => Some(Self::ProgressHalf),
            "quarter_remaining" => Some(Self::QuarterRemaining),
            "one_hour_remaining" => Some(Self::OneHourRemaining),
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
    pub scheduled_at_ms: i64,
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
    planned_at_ms: i64,
    deadline_at_ms: i64,
) -> Result<Vec<SystemReminderNode>, SystemReminderRepositoryError> {
    if planned_at_ms < 0 || deadline_at_ms <= planned_at_ms {
        return Err(SystemReminderRepositoryError::InvalidInput {
            message: "deadline must be later than planned time".to_string(),
        });
    }

    let duration_ms = deadline_at_ms - planned_at_ms;
    let mut candidates = vec![
        (SystemReminderKind::ProgressHalf, planned_at_ms + duration_ms / 2),
        (
            SystemReminderKind::QuarterRemaining,
            planned_at_ms + duration_ms * 3 / 4,
        ),
        (
            SystemReminderKind::OneHourRemaining,
            deadline_at_ms - ONE_HOUR_MS,
        ),
    ];
    candidates.sort_by_key(|(kind, trigger_at_ms)| (*trigger_at_ms, kind.urgency()));

    let mut nodes: Vec<SystemReminderNode> = Vec::new();
    for (kind, raw_trigger_at_ms) in candidates {
        let trigger_at_ms = raw_trigger_at_ms.div_euclid(MINUTE_MS) * MINUTE_MS;
        if trigger_at_ms <= planned_at_ms || trigger_at_ms >= deadline_at_ms {
            continue;
        }
        let node = SystemReminderNode {
            trigger_at_ms,
            deadline_snapshot_ms: deadline_at_ms,
            kind,
        };
        if let Some(existing) = nodes
            .iter_mut()
            .find(|existing| existing.trigger_at_ms == trigger_at_ms)
        {
            if kind.urgency() > existing.kind.urgency() {
                *existing = node;
            }
        } else {
            nodes.push(node);
        }
    }
    nodes.push(SystemReminderNode {
        kind: SystemReminderKind::DdlDue,
        trigger_at_ms: deadline_at_ms,
        deadline_snapshot_ms: deadline_at_ms,
    });
    nodes.sort_by_key(|node| (node.trigger_at_ms, node.kind.urgency()));
    Ok(nodes)
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
        if input.deadline_snapshot_ms <= 0
            || input.scheduled_at_ms <= 0
            || input.fired_at_ms <= 0
        {
            return Err(SystemReminderRepositoryError::InvalidInput {
                message: "system reminder timestamps must be positive".to_string(),
            });
        }

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
                input.scheduled_at_ms,
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
        scheduled_at_ms: i64,
        fired_at_ms: i64,
    ) -> SystemReminderLogEntry {
        SystemReminderRepository::mark_fired(
            connection,
            MarkSystemReminderFiredInput {
                id: new_entity_id("system-reminder"),
                task_id: task_id.to_string(),
                kind,
                deadline_snapshot_ms,
                scheduled_at_ms,
                fired_at_ms,
            },
        )
        .expect("mark fired")
    }

    #[test]
    fn compute_nodes_sets_expected_trigger_times() {
        let planned_at_ms = 0;
        let deadline_at_ms = 10_800_000;
        let nodes = compute_nodes(planned_at_ms, deadline_at_ms).expect("compute nodes");

        assert_eq!(nodes.len(), 4);
        assert_eq!(nodes[0].kind, SystemReminderKind::ProgressHalf);
        assert_eq!(nodes[0].trigger_at_ms, 5_400_000);
        assert_eq!(nodes[1].kind, SystemReminderKind::OneHourRemaining);
        assert_eq!(nodes[1].trigger_at_ms, 7_200_000);
        assert_eq!(nodes[2].kind, SystemReminderKind::QuarterRemaining);
        assert_eq!(nodes[2].trigger_at_ms, 8_100_000);
        assert_eq!(nodes[3].kind, SystemReminderKind::DdlDue);
        assert_eq!(nodes[3].trigger_at_ms, deadline_at_ms);
        assert!(nodes
            .iter()
            .all(|node| node.deadline_snapshot_ms == deadline_at_ms));
    }

    #[test]
    fn ddl_due_kind_round_trips() {
        assert_eq!(SystemReminderKind::DdlDue.as_str(), "ddl_due");
        assert_eq!(
            SystemReminderKind::from_str("ddl_due"),
            Some(SystemReminderKind::DdlDue)
        );
    }

    #[test]
    fn mark_fired_is_idempotent_for_same_task_kind_and_deadline_snapshot() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        seed_task(&connection, "task-1", 10_800_000);

        let first = mark(
            &connection,
            "task-1",
            SystemReminderKind::ProgressHalf,
            10_800_000,
            5_400_000,
            7_200_000,
        );
        let second = mark(
            &connection,
            "task-1",
            SystemReminderKind::ProgressHalf,
            10_800_000,
            5_400_000,
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
            SystemReminderKind::ProgressHalf,
            18_000,
            10_000,
            16_200_000,
        );
        mark(
            &connection,
            "task-1",
            SystemReminderKind::ProgressHalf,
            20_000,
            11_000,
            18_200_000,
        );

        assert!(SystemReminderRepository::has_fired(
            &connection,
            "task-1",
            SystemReminderKind::ProgressHalf,
            18_000
        )
        .expect("old snapshot fired"));
        assert!(SystemReminderRepository::has_fired(
            &connection,
            "task-1",
            SystemReminderKind::ProgressHalf,
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
                SystemReminderKind::QuarterRemaining,
                10_800_000,
                8_100_000,
                9_000_000,
            );
        }

        let reopened = initialize_database(workspace).expect("reopen database");
        let entry = SystemReminderRepository::get_entry(
            &reopened,
            "task-reopen",
            SystemReminderKind::QuarterRemaining,
            10_800_000,
        )
        .expect("get entry")
        .expect("entry exists");

        assert_eq!(entry.fired_at_ms, Some(9_000_000));
        assert_eq!(entry.scheduled_at_ms, 8_100_000);
    }

    #[test]
    fn same_minute_nodes_merge_to_the_most_urgent_kind() {
        let nodes = compute_nodes(1, 120_001).expect("compute nodes");

        assert_eq!(nodes.len(), 2);
        assert_eq!(nodes[0].kind, SystemReminderKind::QuarterRemaining);
        assert_eq!(nodes[0].trigger_at_ms, 60_000);
        assert_eq!(nodes[1].kind, SystemReminderKind::DdlDue);
        assert_eq!(nodes[1].trigger_at_ms, 120_001);
    }
}
