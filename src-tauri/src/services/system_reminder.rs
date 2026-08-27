use rusqlite::Connection;

use crate::db::repositories::system_reminder_repository::{
    compute_nodes, MarkSystemReminderFiredInput, SystemReminderKind, SystemReminderLogEntry,
    SystemReminderNode, SystemReminderRepository, SystemReminderRepositoryError,
};
use crate::errors::AppError;
use crate::id::new_entity_id;

pub use crate::db::repositories::system_reminder_repository::{
    compute_nodes as compute_system_reminder_nodes, SystemReminderKind as SystemDdlReminderKind,
    SystemReminderNode as SystemDdlReminderNode,
};

pub struct SystemReminderService;

impl SystemReminderService {
    pub fn compute_nodes(
        planned_at_ms: i64,
        deadline_at_ms: i64,
    ) -> Result<Vec<SystemReminderNode>, AppError> {
        compute_nodes(planned_at_ms, deadline_at_ms).map_err(map_system_reminder_error)
    }

    pub fn has_fired(
        connection: &Connection,
        task_id: &str,
        kind: SystemReminderKind,
        deadline_snapshot_ms: i64,
    ) -> Result<bool, AppError> {
        SystemReminderRepository::has_fired(connection, task_id, kind, deadline_snapshot_ms)
            .map_err(map_system_reminder_error)
    }

    pub fn mark_fired(
        connection: &Connection,
        task_id: &str,
        kind: SystemReminderKind,
        deadline_snapshot_ms: i64,
        scheduled_at_ms: i64,
        fired_at_ms: i64,
    ) -> Result<SystemReminderLogEntry, AppError> {
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
        .map_err(map_system_reminder_error)
    }
}

fn map_system_reminder_error(error: SystemReminderRepositoryError) -> AppError {
    match error {
        SystemReminderRepositoryError::InvalidInput { message } => {
            AppError::InvalidTaskInput { message }
        }
        SystemReminderRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::reminder_repository::{ReminderRepository, MAX_USER_REMINDERS};
    use crate::services::task::{
        CreateTaskReminderRequest, CreateTaskRequest, PostponeTaskRequest, TaskService,
    };

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

    fn system_log_count(connection: &Connection) -> i64 {
        connection
            .query_row("SELECT COUNT(*) FROM system_reminder_log", [], |row| {
                row.get(0)
            })
            .expect("system log count")
    }

    fn custom_count(connection: &Connection, task_id: &str) -> i64 {
        ReminderRepository::count_for_task(connection, task_id).expect("custom count")
    }

    #[test]
    fn system_nodes_cover_progress_and_remaining_time() {
        let deadline_at_ms = 10_800_000;
        let nodes = SystemReminderService::compute_nodes(0, deadline_at_ms).expect("nodes");

        assert_eq!(nodes.len(), 4);
        assert!(nodes
            .iter()
            .any(|node| node.kind == SystemReminderKind::ProgressHalf));
        assert!(nodes
            .iter()
            .any(|node| node.kind == SystemReminderKind::QuarterRemaining));
        assert!(nodes
            .iter()
            .any(|node| node.kind == SystemReminderKind::OneHourRemaining));
        assert!(nodes
            .iter()
            .any(|node| node.kind == SystemReminderKind::DdlDue));
    }

    #[test]
    fn mark_system_fired_does_not_write_task_reminders() {
        let db = open_test_database();
        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "System only".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: Some(10_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create task");

        SystemReminderService::mark_fired(
            &db.connection,
            &task.id,
            SystemReminderKind::ProgressHalf,
            10_000,
            5_000,
            8_000,
        )
        .expect("mark system fired");

        assert_eq!(custom_count(&db.connection, &task.id), 0);
        assert_eq!(system_log_count(&db.connection), 1);
    }

    #[test]
    fn custom_reminder_does_not_write_system_log() {
        let db = open_test_database();
        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Custom only".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: Some(10_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![CreateTaskReminderRequest {
                    remind_at_ms: 2_000,
                    message: None,
                }],
            },
        )
        .expect("create");

        let reminder_id = TaskService::get_detail(&db.connection, &task.id)
            .expect("detail")
            .reminders[0]
            .id
            .clone();
        TaskService::mark_custom_reminder_fired(&db.connection, &reminder_id, 3_000)
            .expect("mark custom");

        assert_eq!(custom_count(&db.connection, &task.id), 1);
        assert_eq!(system_log_count(&db.connection), 0);
    }

    #[test]
    fn system_reminders_do_not_consume_custom_limit() {
        let db = open_test_database();
        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Limits".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: Some(10_800_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![
                    CreateTaskReminderRequest {
                        remind_at_ms: 2_000,
                        message: None,
                    },
                    CreateTaskReminderRequest {
                        remind_at_ms: 3_000,
                        message: None,
                    },
                    CreateTaskReminderRequest {
                        remind_at_ms: 4_000,
                        message: None,
                    },
                ],
            },
        )
        .expect("create");

        for kind in SystemReminderKind::ALL {
            SystemReminderService::mark_fired(
                &db.connection,
                &task.id,
                kind,
                10_800_000,
                5_400_000,
                5_400_000,
            )
            .expect("mark system");
        }

        assert_eq!(
            custom_count(&db.connection, &task.id),
            MAX_USER_REMINDERS as i64
        );
        assert_eq!(system_log_count(&db.connection), 4);
    }

    #[test]
    fn postpone_allows_new_deadline_snapshot_without_blocking_on_old_fired_fact() {
        let db = open_test_database();
        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Postpone system".to_string(),
                note: None,
                planned_at_ms: 10_000_000,
                deadline_at_ms: Some(18_000_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create");

        SystemReminderService::mark_fired(
            &db.connection,
            &task.id,
            SystemReminderKind::ProgressHalf,
            18_000_000,
            14_000_000,
            14_400_000,
        )
        .expect("mark old ddl_60");

        TaskService::postpone(
            &db.connection,
            PostponeTaskRequest {
                task_id: task.id.clone(),
                new_deadline_at_ms: 20_000_000,
                reason: "接口延迟".to_string(),
            },
        )
        .expect("postpone");

        assert!(SystemReminderService::has_fired(
            &db.connection,
            &task.id,
            SystemReminderKind::ProgressHalf,
            18_000_000
        )
        .expect("old snapshot"));
        assert!(!SystemReminderService::has_fired(
            &db.connection,
            &task.id,
            SystemReminderKind::ProgressHalf,
            20_000_000
        )
        .expect("new snapshot"));

        SystemReminderService::mark_fired(
            &db.connection,
            &task.id,
            SystemReminderKind::ProgressHalf,
            20_000_000,
            15_000_000,
            16_400_000,
        )
        .expect("mark new ddl_60");

        assert_eq!(system_log_count(&db.connection), 2);
    }

    #[test]
    fn nodes_outside_the_task_range_are_skipped() {
        let planned_at_ms = 17_700_000;
        let deadline_at_ms = 18_000_000;
        let nodes =
            SystemReminderService::compute_nodes(planned_at_ms, deadline_at_ms).expect("nodes");

        assert!(nodes.iter().all(|node| {
            node.trigger_at_ms > planned_at_ms && node.trigger_at_ms <= deadline_at_ms
        }));
        assert_eq!(system_log_count(&open_test_database().connection), 0);
    }
}
