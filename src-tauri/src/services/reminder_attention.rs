use std::sync::Mutex;

use tauri::{AppHandle, Manager, Runtime, UserAttentionType};

use super::reminder_engine::ReminderTriggeredPayload;

pub const MAIN_WINDOW_LABEL: &str = "main";

pub trait ReminderAttention: Send + Sync {
    fn request(&self, payload: &ReminderTriggeredPayload) -> Result<(), String>;
}

pub struct TauriReminderAttention<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriReminderAttention<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> ReminderAttention for TauriReminderAttention<R> {
    fn request(&self, _payload: &ReminderTriggeredPayload) -> Result<(), String> {
        let Some(window) = self.app.get_webview_window(MAIN_WINDOW_LABEL) else {
            return Err(format!("main window '{MAIN_WINDOW_LABEL}' not found"));
        };

        window
            .request_user_attention(Some(UserAttentionType::Informational))
            .map_err(|error| error.to_string())
    }
}

pub fn deliver_triggered_attention(
    attention: &dyn ReminderAttention,
    triggered: &[ReminderTriggeredPayload],
) {
    for payload in triggered {
        if let Err(error) = attention.request(payload) {
            eprintln!("reminder attention failed: {error}");
        }
    }
}

#[derive(Default)]
pub struct RecordingReminderAttention {
    requested: Mutex<Vec<ReminderTriggeredPayload>>,
    fail_next: Mutex<bool>,
}

impl RecordingReminderAttention {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_fail_next(&self, fail: bool) {
        *self.fail_next.lock().expect("lock fail_next") = fail;
    }

    pub fn requested_payloads(&self) -> Vec<ReminderTriggeredPayload> {
        self.requested.lock().expect("lock requested").clone()
    }
}

impl ReminderAttention for RecordingReminderAttention {
    fn request(&self, payload: &ReminderTriggeredPayload) -> Result<(), String> {
        if *self.fail_next.lock().expect("lock fail_next") {
            return Err("forced attention failure".to_string());
        }
        self.requested
            .lock()
            .expect("lock requested")
            .push(payload.clone());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::reminder_repository::ReminderRepository;
    use crate::db::repositories::settings_repository::SettingsRepository;
    use crate::services::reminder_engine::ReminderEngineService;
    use crate::services::reminder_notifier::{
        deliver_triggered_reminders, RecordingReminderNotifier,
    };
    use crate::services::task::{
        CreateTaskReminderRequest, CreateTaskRequest, PostponeTaskRequest, TaskService,
    };

    struct TestDatabase {
        _temp: tempfile::TempDir,
        pub connection: rusqlite::Connection,
    }

    fn open_test_database() -> TestDatabase {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        SettingsRepository::ensure_defaults(&connection, 1).expect("seed settings");
        TestDatabase {
            _temp: temp,
            connection,
        }
    }

    fn create_task_with_deadline(
        connection: &rusqlite::Connection,
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

    fn run_tick_with_attention(
        connection: &rusqlite::Connection,
        now_ms: i64,
        cutoff_ms: i64,
        attention: &RecordingReminderAttention,
    ) -> crate::services::reminder_engine::ReminderEngineTickResult {
        let tick = ReminderEngineService::tick(connection, now_ms, cutoff_ms).expect("tick");
        deliver_triggered_attention(attention, &tick.triggered);
        tick
    }

    fn run_tick_with_notifier_and_attention(
        connection: &rusqlite::Connection,
        now_ms: i64,
        cutoff_ms: i64,
        notifier: &RecordingReminderNotifier,
        attention: &RecordingReminderAttention,
    ) -> crate::services::reminder_engine::ReminderEngineTickResult {
        let tick = ReminderEngineService::tick(connection, now_ms, cutoff_ms).expect("tick");
        deliver_triggered_reminders(notifier, &tick.triggered);
        deliver_triggered_attention(attention, &tick.triggered);
        tick
    }

    #[test]
    fn custom_reminder_fire_requests_attention_once() {
        let db = open_test_database();
        let attention = RecordingReminderAttention::new();
        let cutoff = 10_000;
        create_task_with_deadline(
            &db.connection,
            "提交方案",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );

        run_tick_with_attention(&db.connection, 12_000, cutoff, &attention);
        assert_eq!(attention.requested_payloads().len(), 1);

        run_tick_with_attention(&db.connection, 12_500, cutoff, &attention);
        assert_eq!(attention.requested_payloads().len(), 1);
    }

    #[test]
    fn system_ddl_attention_requests_once_per_kind() {
        let db = open_test_database();
        let attention = RecordingReminderAttention::new();
        let cutoff = 10_000;
        create_task_with_deadline(&db.connection, "提交方案", 1_000, 10_800_000, vec![]);

        run_tick_with_attention(&db.connection, 7_200_000, cutoff, &attention);
        run_tick_with_attention(&db.connection, 9_000_000, cutoff, &attention);
        run_tick_with_attention(&db.connection, 10_200_000, cutoff, &attention);
        run_tick_with_attention(&db.connection, 10_800_000, cutoff, &attention);

        let kinds: Vec<_> = attention
            .requested_payloads()
            .into_iter()
            .filter_map(|payload| match payload {
                ReminderTriggeredPayload::System { reminder_kind, .. } => Some(reminder_kind),
                _ => None,
            })
            .collect();
        assert_eq!(
            kinds,
            vec![
                "one_hour_remaining".to_string(),
                "quarter_remaining".to_string(),
                "ddl_due".to_string(),
            ]
        );
    }

    #[test]
    fn future_reminder_does_not_request_attention() {
        let db = open_test_database();
        let attention = RecordingReminderAttention::new();
        let cutoff = 10_000;
        create_task_with_deadline(
            &db.connection,
            "future",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 15_000,
                message: None,
            }],
        );

        run_tick_with_attention(&db.connection, 12_000, cutoff, &attention);
        assert!(attention.requested_payloads().is_empty());
    }

    #[test]
    fn completed_task_does_not_request_attention() {
        let db = open_test_database();
        let attention = RecordingReminderAttention::new();
        let cutoff = 10_000;
        let task = create_task_with_deadline(
            &db.connection,
            "done",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );
        TaskService::complete(&db.connection, &task.id).expect("complete");

        run_tick_with_attention(&db.connection, 12_000, cutoff, &attention);
        assert!(attention.requested_payloads().is_empty());
    }

    #[test]
    fn startup_cutoff_skips_historical_attention() {
        let db = open_test_database();
        let attention = RecordingReminderAttention::new();
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

        ReminderEngineService::reconcile_at_startup(&db.connection, cutoff).expect("reconcile");
        run_tick_with_attention(&db.connection, cutoff, cutoff, &attention);
        assert!(attention.requested_payloads().is_empty());
    }

    #[test]
    fn notification_failure_still_requests_attention() {
        let db = open_test_database();
        let notifier = RecordingReminderNotifier::new();
        notifier.set_fail_next(true);
        let attention = RecordingReminderAttention::new();
        let cutoff = 10_000;
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

        run_tick_with_notifier_and_attention(&db.connection, 12_000, cutoff, &notifier, &attention);
        assert!(notifier.delivered_payloads().is_empty());
        assert_eq!(attention.requested_payloads().len(), 1);
    }

    #[test]
    fn attention_failure_does_not_block_engine_or_fired_fact() {
        let db = open_test_database();
        let attention = RecordingReminderAttention::new();
        attention.set_fail_next(true);
        let cutoff = 10_000;
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

        let tick = run_tick_with_attention(&db.connection, 12_000, cutoff, &attention);
        assert_eq!(tick.triggered.len(), 1);
        assert_eq!(
            ReminderRepository::count_unfired_at_or_before_cutoff(&db.connection, cutoff)
                .expect("count"),
            0
        );

        attention.set_fail_next(false);
        let second = run_tick_with_attention(&db.connection, 12_500, cutoff, &attention);
        assert!(second.triggered.is_empty());
    }

    #[test]
    fn forced_attention_failure_does_not_crash_delivery_loop() {
        let attention = RecordingReminderAttention::new();
        attention.set_fail_next(true);
        let payloads = vec![
            ReminderTriggeredPayload::Custom {
                reminder_id: "r1".to_string(),
                task_id: "t1".to_string(),
                task_title: "A".to_string(),
                remind_at_ms: 1,
                fired_at_ms: 2,
                message: None,
            },
            ReminderTriggeredPayload::Custom {
                reminder_id: "r2".to_string(),
                task_id: "t2".to_string(),
                task_title: "B".to_string(),
                remind_at_ms: 3,
                fired_at_ms: 4,
                message: None,
            },
        ];
        deliver_triggered_attention(&attention, &payloads);
        assert!(attention.requested_payloads().is_empty());
    }

    #[test]
    fn postpone_uses_new_snapshot_for_attention() {
        let db = open_test_database();
        let attention = RecordingReminderAttention::new();
        let cutoff = 10_000_000;
        let task =
            create_task_with_deadline(&db.connection, "提交方案", 10_000_000, 18_000_000, vec![]);

        run_tick_with_attention(&db.connection, 14_400_000, cutoff, &attention);
        TaskService::postpone(
            &db.connection,
            PostponeTaskRequest {
                task_id: task.id.clone(),
                new_deadline_at_ms: 20_000_000,
                reason: "delay".to_string(),
            },
        )
        .expect("postpone");

        run_tick_with_attention(&db.connection, 16_400_000, cutoff, &attention);
        let kinds: Vec<_> = attention
            .requested_payloads()
            .into_iter()
            .filter_map(|payload| match payload {
                ReminderTriggeredPayload::System {
                    reminder_kind,
                    deadline_snapshot_ms,
                    ..
                } => Some((reminder_kind, deadline_snapshot_ms)),
                _ => None,
            })
            .collect();
        assert_eq!(kinds.len(), 2);
        assert_eq!(kinds[0], ("one_hour_remaining".to_string(), 18_000_000));
        assert_eq!(kinds[1], ("one_hour_remaining".to_string(), 20_000_000));
    }
}
