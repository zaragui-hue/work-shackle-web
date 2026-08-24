use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::reminder_repository::ReminderRepository;
use crate::db::repositories::system_reminder_repository::{
    compute_nodes, SystemReminderKind, SystemReminderLogEntry, SystemReminderRepository,
};
use crate::db::repositories::task_repository::TaskRepository;
use crate::errors::AppError;
use crate::services::system_reminder::SystemReminderService;
use crate::services::task::TaskService;

pub const REMINDER_TRIGGERED_EVENT: &str = "reminder://triggered";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderStartupReconciliation {
    pub cutoff_ms: i64,
    pub skipped_custom_count: i64,
    pub skipped_system_count: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum ReminderTriggeredPayload {
    #[serde(rename = "custom")]
    Custom {
        reminder_id: String,
        task_id: String,
        task_title: String,
        remind_at_ms: i64,
        fired_at_ms: i64,
        message: Option<String>,
    },
    #[serde(rename = "system")]
    System {
        task_id: String,
        task_title: String,
        reminder_kind: String,
        deadline_snapshot_ms: i64,
        trigger_at_ms: i64,
        fired_at_ms: i64,
    },
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReminderEngineTickResult {
    pub triggered: Vec<ReminderTriggeredPayload>,
    pub errors: Vec<String>,
}

pub struct ReminderEngineService;

impl ReminderEngineService {
    pub fn is_fire_eligible(scheduled_at_ms: i64, now_ms: i64, cutoff_ms: i64) -> bool {
        scheduled_at_ms > cutoff_ms && scheduled_at_ms <= now_ms
    }

    pub fn reconcile_at_startup(
        connection: &Connection,
        cutoff_ms: i64,
    ) -> Result<ReminderStartupReconciliation, AppError> {
        if cutoff_ms <= 0 {
            return Err(AppError::InvalidTaskInput {
                message: "reminder cutoff must be positive".to_string(),
            });
        }

        let skipped_custom_count =
            ReminderRepository::count_unfired_at_or_before_cutoff(connection, cutoff_ms)
                .map_err(map_reminder_error)?;
        Ok(ReminderStartupReconciliation {
            cutoff_ms,
            skipped_custom_count,
            skipped_system_count: 0,
        })
    }

    pub fn tick(
        connection: &Connection,
        now_ms: i64,
        cutoff_ms: i64,
    ) -> Result<ReminderEngineTickResult, AppError> {
        if now_ms <= 0 || cutoff_ms <= 0 {
            return Err(AppError::InvalidTaskInput {
                message: "reminder engine timestamps must be positive".to_string(),
            });
        }

        let mut triggered = Vec::new();
        let mut errors = Vec::new();

        let custom_due = ReminderRepository::list_due_for_engine(connection, now_ms, cutoff_ms)
            .map_err(map_reminder_error)?;
        for reminder in custom_due {
            let task_title = TaskRepository::get_by_id(connection, &reminder.task_id)
                .map(|task| task.title)
                .unwrap_or_else(|_| "任务".to_string());
            match TaskService::mark_custom_reminder_fired(connection, &reminder.id, now_ms) {
                Ok(updated) => triggered.push(ReminderTriggeredPayload::Custom {
                    reminder_id: updated.id,
                    task_id: updated.task_id,
                    task_title,
                    remind_at_ms: updated.remind_at_ms,
                    fired_at_ms: updated.fired_at_ms.unwrap_or(now_ms),
                    message: updated.message,
                }),
                Err(error) => errors.push(error.to_string()),
            }
        }

        let ddl_tasks =
            TaskRepository::list_ddl_reminder_candidates(connection).map_err(map_task_error)?;
        for task in ddl_tasks {
            let Some(deadline_snapshot_ms) = task.deadline_at_ms else {
                continue;
            };
            if now_ms <= task.planned_at_ms || now_ms >= deadline_snapshot_ms {
                continue;
            }

            let nodes = compute_nodes(task.planned_at_ms, deadline_snapshot_ms)
                .map_err(map_system_reminder_error)?;
            let mut selected_triggered: Option<(SystemReminderLogEntry, SystemReminderKind)> = None;
            for node in nodes {
                if node.trigger_at_ms > now_ms {
                    continue;
                }
                if SystemReminderRepository::has_fired(
                    connection,
                    &task.id,
                    node.kind,
                    deadline_snapshot_ms,
                )
                .map_err(map_system_reminder_error)?
                {
                    continue;
                }

                match SystemReminderService::mark_fired(
                    connection,
                    &task.id,
                    node.kind,
                    deadline_snapshot_ms,
                    node.trigger_at_ms,
                    now_ms,
                ) {
                    Ok(entry) => match selected_triggered.as_ref() {
                        Some((_, selected_kind))
                            if selected_kind.urgency() >= node.kind.urgency() => {}
                        _ => selected_triggered = Some((entry, node.kind)),
                    },
                    Err(error) => errors.push(error.to_string()),
                }
            }
            if let Some((entry, kind)) = selected_triggered {
                triggered.push(ReminderTriggeredPayload::System {
                    task_id: entry.task_id,
                    task_title: task.title,
                    reminder_kind: kind.as_str().to_string(),
                    deadline_snapshot_ms: entry.deadline_snapshot_ms,
                    trigger_at_ms: entry.scheduled_at_ms,
                    fired_at_ms: entry.fired_at_ms.unwrap_or(now_ms),
                });
            }
        }

        Ok(ReminderEngineTickResult { triggered, errors })
    }
}

fn map_reminder_error(
    error: crate::db::repositories::reminder_repository::ReminderRepositoryError,
) -> AppError {
    match error {
        crate::db::repositories::reminder_repository::ReminderRepositoryError::InvalidInput {
            message,
        } => AppError::InvalidTaskInput { message },
        crate::db::repositories::reminder_repository::ReminderRepositoryError::NotFound { id } => {
            AppError::InvalidTaskInput {
                message: format!("reminder not found: {id}"),
            }
        }
        crate::db::repositories::reminder_repository::ReminderRepositoryError::LimitReached {
            limit,
        } => AppError::ReminderLimitReached { limit },
        crate::db::repositories::reminder_repository::ReminderRepositoryError::Db(db_error) => {
            AppError::DatabaseError {
                message: db_error.to_string(),
            }
        }
    }
}

fn map_task_error(
    error: crate::db::repositories::task_repository::TaskRepositoryError,
) -> AppError {
    match error {
        crate::db::repositories::task_repository::TaskRepositoryError::NotFound { id } => {
            AppError::TaskNotFound { id }
        }
        crate::db::repositories::task_repository::TaskRepositoryError::InvalidInput { message } => {
            AppError::InvalidTaskInput { message }
        }
        crate::db::repositories::task_repository::TaskRepositoryError::Db(db_error) => {
            AppError::DatabaseError {
                message: db_error.to_string(),
            }
        }
    }
}

fn map_system_reminder_error(
    error: crate::db::repositories::system_reminder_repository::SystemReminderRepositoryError,
) -> AppError {
    match error {
        crate::db::repositories::system_reminder_repository::SystemReminderRepositoryError::InvalidInput {
            message,
        } => AppError::InvalidTaskInput { message },
        crate::db::repositories::system_reminder_repository::SystemReminderRepositoryError::Db(
            db_error,
        ) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::reminder_repository::ReminderRepository;
    use crate::services::task::{
        CreateTaskReminderRequest, CreateTaskRequest, PostponeTaskRequest, TaskService,
    };
    use crate::services::workspace_switch::AppState;

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

    fn create_task_with_deadline(
        connection: &Connection,
        title: &str,
        planned_at_ms: i64,
        deadline_at_ms: i64,
        reminders: Vec<CreateTaskReminderRequest>,
    ) -> crate::services::task::TaskDto {
        TaskService::create(
            connection,
            CreateTaskRequest {
                title: title.to_string(),
                note: None,
                planned_at_ms,
                deadline_at_ms: Some(deadline_at_ms),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders,
            },
        )
        .expect("create task")
    }

    fn custom_fired_count(connection: &Connection) -> i64 {
        connection
            .query_row(
                "SELECT COUNT(*) FROM task_reminders WHERE fired_at_ms IS NOT NULL",
                [],
                |row| row.get(0),
            )
            .expect("custom fired count")
    }

    fn system_fired_count(connection: &Connection) -> i64 {
        connection
            .query_row("SELECT COUNT(*) FROM system_reminder_log", [], |row| {
                row.get(0)
            })
            .expect("system fired count")
    }

    #[test]
    fn future_custom_reminder_does_not_fire() {
        let db = open_test_database();
        let cutoff = 10_000;
        create_task_with_deadline(
            &db.connection,
            "future custom",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 15_000,
                message: None,
            }],
        );

        let result = ReminderEngineService::tick(&db.connection, 12_000, cutoff).expect("tick");
        assert!(result.triggered.is_empty());
        assert_eq!(custom_fired_count(&db.connection), 0);
    }

    #[test]
    fn custom_reminder_fires_when_remind_at_reached_after_cutoff() {
        let db = open_test_database();
        let cutoff = 10_000;
        create_task_with_deadline(
            &db.connection,
            "due custom",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: Some("ping".to_string()),
            }],
        );

        let result = ReminderEngineService::tick(&db.connection, 12_000, cutoff).expect("tick");
        assert_eq!(result.triggered.len(), 1);
        assert!(matches!(
            &result.triggered[0],
            ReminderTriggeredPayload::Custom {
                remind_at_ms: 12_000,
                ..
            }
        ));
        assert_eq!(custom_fired_count(&db.connection), 1);
    }

    #[test]
    fn future_system_reminder_does_not_fire() {
        let db = open_test_database();
        let cutoff = 10_000;
        create_task_with_deadline(&db.connection, "future system", 1_000, 10_800_000, vec![]);

        let result = ReminderEngineService::tick(&db.connection, 10_000, cutoff).expect("tick");
        assert!(result.triggered.is_empty());
        assert_eq!(system_fired_count(&db.connection), 0);
    }

    #[test]
    fn system_reminder_fires_the_most_urgent_due_node() {
        let db = open_test_database();
        let cutoff = 10_000;
        let task =
            create_task_with_deadline(&db.connection, "due system", 1_000, 10_800_000, vec![]);

        let result = ReminderEngineService::tick(&db.connection, 7_200_000, cutoff).expect("tick");
        assert_eq!(result.triggered.len(), 1);
        assert!(matches!(
            &result.triggered[0],
            ReminderTriggeredPayload::System {
                task_id,
                reminder_kind,
                trigger_at_ms: 7_200_000,
                ..
            } if task_id == &task.id && reminder_kind == "one_hour_remaining"
        ));
        assert_eq!(system_fired_count(&db.connection), 2);
    }

    #[test]
    fn repeated_tick_does_not_refire_custom_reminder() {
        let db = open_test_database();
        let cutoff = 10_000;
        create_task_with_deadline(
            &db.connection,
            "once custom",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );

        ReminderEngineService::tick(&db.connection, 12_000, cutoff).expect("first tick");
        let second = ReminderEngineService::tick(&db.connection, 12_500, cutoff).expect("second");
        assert!(second.triggered.is_empty());
        assert_eq!(custom_fired_count(&db.connection), 1);
    }

    #[test]
    fn repeated_tick_does_not_refire_system_reminder() {
        let db = open_test_database();
        let cutoff = 10_000;
        create_task_with_deadline(&db.connection, "once system", 1_000, 10_800_000, vec![]);

        ReminderEngineService::tick(&db.connection, 7_200_000, cutoff).expect("first tick");
        let second =
            ReminderEngineService::tick(&db.connection, 7_250_000, cutoff).expect("second");
        assert!(second.triggered.is_empty());
        assert_eq!(system_fired_count(&db.connection), 2);
    }

    #[test]
    fn different_deadline_snapshots_can_both_fire() {
        let db = open_test_database();
        let cutoff = 10_000_000;
        let task = create_task_with_deadline(
            &db.connection,
            "postponed system",
            10_000_000,
            18_000_000,
            vec![],
        );

        ReminderEngineService::tick(&db.connection, 14_400_000, cutoff).expect("old progress tick");
        TaskService::postpone(
            &db.connection,
            PostponeTaskRequest {
                task_id: task.id.clone(),
                new_deadline_at_ms: 20_000_000,
                reason: "delay".to_string(),
            },
        )
        .expect("postpone");

        let result =
            ReminderEngineService::tick(&db.connection, 16_400_000, cutoff).expect("new progress");
        assert_eq!(result.triggered.len(), 1);
        assert!(matches!(
            &result.triggered[0],
            ReminderTriggeredPayload::System {
                deadline_snapshot_ms: 20_000_000,
                reminder_kind,
                ..
            } if reminder_kind == "one_hour_remaining"
        ));
        assert_eq!(system_fired_count(&db.connection), 4);
    }

    #[test]
    fn completed_task_does_not_fire_custom_reminder() {
        let db = open_test_database();
        let cutoff = 10_000;
        let task = create_task_with_deadline(
            &db.connection,
            "done custom",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );
        TaskService::complete(&db.connection, &task.id).expect("complete");

        let result = ReminderEngineService::tick(&db.connection, 12_000, cutoff).expect("tick");
        assert!(result.triggered.is_empty());
        assert_eq!(custom_fired_count(&db.connection), 0);
    }

    #[test]
    fn completed_task_does_not_fire_system_reminder() {
        let db = open_test_database();
        let cutoff = 10_000;
        let task =
            create_task_with_deadline(&db.connection, "done system", 1_000, 10_800_000, vec![]);
        TaskService::complete(&db.connection, &task.id).expect("complete");

        let result = ReminderEngineService::tick(&db.connection, 7_200_000, cutoff).expect("tick");
        assert!(result.triggered.is_empty());
        assert_eq!(system_fired_count(&db.connection), 0);
    }

    #[test]
    fn cancelled_task_does_not_fire_system_reminder() {
        let db = open_test_database();
        let cutoff = 10_000;
        let task = create_task_with_deadline(
            &db.connection,
            "cancelled system",
            1_000,
            10_800_000,
            vec![],
        );
        TaskService::cancel(&db.connection, &task.id).expect("cancel");

        let result = ReminderEngineService::tick(&db.connection, 7_200_000, cutoff).expect("tick");
        assert!(result.triggered.is_empty());
        assert_eq!(system_fired_count(&db.connection), 0);
    }

    #[test]
    fn cancelled_task_future_custom_reminder_is_not_due_candidate() {
        let db = open_test_database();
        let cutoff = 10_000;
        let task = create_task_with_deadline(
            &db.connection,
            "cancelled future custom",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 15_000,
                message: None,
            }],
        );
        TaskService::cancel(&db.connection, &task.id).expect("cancel");

        let due = ReminderRepository::list_due_for_engine(&db.connection, 20_000, cutoff)
            .expect("list due");
        assert!(due.is_empty());
    }

    #[test]
    fn cancelled_task_does_not_fire_custom_reminder() {
        let db = open_test_database();
        let cutoff = 10_000;
        let task = create_task_with_deadline(
            &db.connection,
            "cancelled custom",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );
        TaskService::cancel(&db.connection, &task.id).expect("cancel");

        let result = ReminderEngineService::tick(&db.connection, 12_000, cutoff).expect("tick");
        assert!(result.triggered.is_empty());
        assert_eq!(custom_fired_count(&db.connection), 0);
    }

    #[test]
    fn startup_reconciliation_skips_historical_reminders_without_firing() {
        let db = open_test_database();
        let cutoff = 18_000_000;
        create_task_with_deadline(
            &db.connection,
            "historical",
            17_700_000,
            18_000_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 17_900_000,
                message: None,
            }],
        );

        let reconciliation =
            ReminderEngineService::reconcile_at_startup(&db.connection, cutoff).expect("reconcile");
        assert_eq!(reconciliation.skipped_custom_count, 1);
        assert_eq!(reconciliation.skipped_system_count, 0);

        let tick = ReminderEngineService::tick(&db.connection, cutoff, cutoff).expect("tick");
        assert!(tick.triggered.is_empty());
        assert_eq!(custom_fired_count(&db.connection), 0);
        assert_eq!(system_fired_count(&db.connection), 0);
    }

    #[test]
    fn active_task_catches_up_to_the_latest_due_node_after_cutoff() {
        let db = open_test_database();
        let cutoff = 18_000_000;
        create_task_with_deadline(
            &db.connection,
            "after cutoff",
            10_000_000,
            25_200_000,
            vec![],
        );

        ReminderEngineService::reconcile_at_startup(&db.connection, cutoff).expect("reconcile");
        let result = ReminderEngineService::tick(&db.connection, cutoff, cutoff)
            .expect("startup catch-up tick");
        assert_eq!(result.triggered.len(), 1);
        assert!(matches!(
            &result.triggered[0],
            ReminderTriggeredPayload::System {
                reminder_kind,
                ..
            } if reminder_kind == "progress_half"
        ));
    }

    #[test]
    fn single_tick_can_fire_multiple_due_reminders_after_cutoff() {
        let db = open_test_database();
        let cutoff = 10_000;
        create_task_with_deadline(
            &db.connection,
            "multi",
            1_000,
            10_800_000,
            vec![
                CreateTaskReminderRequest {
                    remind_at_ms: 7_000_000,
                    message: None,
                },
                CreateTaskReminderRequest {
                    remind_at_ms: 8_000_000,
                    message: None,
                },
            ],
        );

        let result = ReminderEngineService::tick(&db.connection, 9_000_000, cutoff).expect("tick");
        assert_eq!(result.triggered.len(), 3);
        assert_eq!(custom_fired_count(&db.connection), 2);
        assert_eq!(system_fired_count(&db.connection), 3);
    }

    #[test]
    fn one_failed_custom_reminder_does_not_block_other_fires() {
        let db = open_test_database();
        let cutoff = 10_000;
        let done = create_task_with_deadline(
            &db.connection,
            "done",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );
        TaskService::complete(&db.connection, &done.id).expect("complete");
        create_task_with_deadline(
            &db.connection,
            "open",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );

        let result = ReminderEngineService::tick(&db.connection, 12_000, cutoff).expect("tick");
        assert_eq!(result.triggered.len(), 1);
        assert_eq!(custom_fired_count(&db.connection), 1);
    }

    #[test]
    fn workspace_switch_uses_new_cutoff_and_database() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace_a = temp.path().join("a");
        let workspace_b = temp.path().join("b");
        std::fs::create_dir_all(&workspace_a).expect("create a");
        std::fs::create_dir_all(&workspace_b).expect("create b");

        let connection_a = initialize_database(&workspace_a).expect("init a");
        create_task_with_deadline(
            &connection_a,
            "workspace a",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );
        drop(connection_a);

        let state = AppState::new();
        state
            .set_active_for_test(&workspace_a, 10_000)
            .expect("activate a");
        let tick_a = state.run_reminder_tick(12_000).expect("tick a");
        assert_eq!(tick_a.triggered.len(), 1);

        state
            .set_active_for_test(&workspace_b, 20_000)
            .expect("activate b");
        let tick_b = state.run_reminder_tick(25_000).expect("tick b");
        assert!(tick_b.triggered.is_empty());

        let connection_b = initialize_database(&workspace_b).expect("init b");
        create_task_with_deadline(
            &connection_b,
            "workspace b",
            21_000,
            30_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 24_000,
                message: None,
            }],
        );
        state
            .set_active_for_test(&workspace_b, 20_000)
            .expect("reactivate b");
        let tick_b2 = state.run_reminder_tick(24_000).expect("tick b2");
        assert_eq!(tick_b2.triggered.len(), 1);
    }
}
