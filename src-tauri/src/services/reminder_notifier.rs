use std::sync::Mutex;

use tauri::{AppHandle, Runtime};
use tauri_plugin_notification::{NotificationExt, PermissionState};

use super::reminder_engine::ReminderTriggeredPayload;

pub const NOTIFICATION_TITLE: &str = "Work Shackle";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ReminderNotificationContent {
    pub title: String,
    pub body: String,
}

pub trait ReminderNotifier: Send + Sync {
    fn deliver(&self, payload: &ReminderTriggeredPayload) -> Result<(), String>;
}

pub struct TauriReminderNotifier<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriReminderNotifier<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> ReminderNotifier for TauriReminderNotifier<R> {
    fn deliver(&self, payload: &ReminderTriggeredPayload) -> Result<(), String> {
        if !ensure_notification_permission(&self.app)? {
            return Err("notification permission denied".to_string());
        }

        let content = build_notification_content(payload);
        self.app
            .notification()
            .builder()
            .title(content.title)
            .body(content.body)
            .show()
            .map_err(|error| error.to_string())
    }
}

pub fn ensure_notification_permission<R: Runtime>(app: &AppHandle<R>) -> Result<bool, String> {
    let notification = app.notification();
    match notification
        .permission_state()
        .map_err(|error| error.to_string())?
    {
        PermissionState::Granted => Ok(true),
        PermissionState::Prompt | PermissionState::PromptWithRationale => {
            match notification
                .request_permission()
                .map_err(|error| error.to_string())?
            {
                PermissionState::Granted => Ok(true),
                _ => Ok(false),
            }
        }
        PermissionState::Denied => Ok(false),
    }
}

pub fn build_notification_content(
    payload: &ReminderTriggeredPayload,
) -> ReminderNotificationContent {
    match payload {
        ReminderTriggeredPayload::Custom {
            task_title,
            message,
            ..
        } => {
            let body = if let Some(message) = message.as_ref().filter(|value| !value.is_empty()) {
                format!("「{task_title}」{message}")
            } else {
                format!("「{task_title}」该提醒啦")
            };
            ReminderNotificationContent {
                title: NOTIFICATION_TITLE.to_string(),
                body,
            }
        }
        ReminderTriggeredPayload::System {
            task_title,
            reminder_kind,
            ..
        } => {
            let body = match reminder_kind.as_str() {
                "ddl_60" => format!("「{task_title}」距离 DDL 还有 1 小时"),
                "ddl_30" => format!("「{task_title}」距离 DDL 还有 30 分钟"),
                "ddl_10" => format!("「{task_title}」距离 DDL 还有 10 分钟"),
                "ddl_due" => format!("「{task_title}」DDL 到啦"),
                other => format!("「{task_title}」{other}"),
            };
            ReminderNotificationContent {
                title: NOTIFICATION_TITLE.to_string(),
                body,
            }
        }
    }
}

pub fn deliver_triggered_reminders(
    notifier: &dyn ReminderNotifier,
    triggered: &[ReminderTriggeredPayload],
) {
    for payload in triggered {
        if let Err(error) = notifier.deliver(payload) {
            eprintln!("reminder notification failed: {error}");
        }
    }
}

#[derive(Default)]
pub struct RecordingReminderNotifier {
    delivered: Mutex<Vec<ReminderTriggeredPayload>>,
    fail_next: Mutex<bool>,
}

impl RecordingReminderNotifier {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_fail_next(&self, fail: bool) {
        *self.fail_next.lock().expect("lock fail_next") = fail;
    }

    pub fn delivered_payloads(&self) -> Vec<ReminderTriggeredPayload> {
        self.delivered.lock().expect("lock delivered").clone()
    }
}

impl ReminderNotifier for RecordingReminderNotifier {
    fn deliver(&self, payload: &ReminderTriggeredPayload) -> Result<(), String> {
        if *self.fail_next.lock().expect("lock fail_next") {
            return Err("forced notification failure".to_string());
        }
        self.delivered
            .lock()
            .expect("lock delivered")
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

    fn run_tick_with_notifier(
        connection: &rusqlite::Connection,
        now_ms: i64,
        cutoff_ms: i64,
        notifier: &RecordingReminderNotifier,
    ) -> crate::services::reminder_engine::ReminderEngineTickResult {
        let tick = ReminderEngineService::tick(connection, now_ms, cutoff_ms).expect("tick");
        deliver_triggered_reminders(notifier, &tick.triggered);
        tick
    }

    #[test]
    fn custom_reminder_fire_delivers_notification_once() {
        let db = open_test_database();
        let notifier = RecordingReminderNotifier::new();
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

        run_tick_with_notifier(&db.connection, 12_000, cutoff, &notifier);
        assert_eq!(notifier.delivered_payloads().len(), 1);

        run_tick_with_notifier(&db.connection, 12_500, cutoff, &notifier);
        assert_eq!(notifier.delivered_payloads().len(), 1);
    }

    #[test]
    fn system_ddl_notifications_fire_once_per_kind() {
        let db = open_test_database();
        let notifier = RecordingReminderNotifier::new();
        let cutoff = 10_000;
        create_task_with_deadline(&db.connection, "提交方案", 1_000, 10_800_000, vec![]);

        run_tick_with_notifier(&db.connection, 7_200_000, cutoff, &notifier);
        run_tick_with_notifier(&db.connection, 9_000_000, cutoff, &notifier);
        run_tick_with_notifier(&db.connection, 10_200_000, cutoff, &notifier);
        run_tick_with_notifier(&db.connection, 10_800_000, cutoff, &notifier);

        let kinds: Vec<_> = notifier
            .delivered_payloads()
            .into_iter()
            .filter_map(|payload| match payload {
                ReminderTriggeredPayload::System { reminder_kind, .. } => Some(reminder_kind),
                _ => None,
            })
            .collect();
        assert_eq!(
            kinds,
            vec![
                "ddl_60".to_string(),
                "ddl_30".to_string(),
                "ddl_10".to_string(),
                "ddl_due".to_string(),
            ]
        );
    }

    #[test]
    fn future_reminder_does_not_notify() {
        let db = open_test_database();
        let notifier = RecordingReminderNotifier::new();
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

        run_tick_with_notifier(&db.connection, 12_000, cutoff, &notifier);
        assert!(notifier.delivered_payloads().is_empty());
    }

    #[test]
    fn completed_task_does_not_notify() {
        let db = open_test_database();
        let notifier = RecordingReminderNotifier::new();
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

        run_tick_with_notifier(&db.connection, 12_000, cutoff, &notifier);
        assert!(notifier.delivered_payloads().is_empty());
    }

    #[test]
    fn startup_cutoff_skips_historical_notifications() {
        let db = open_test_database();
        let notifier = RecordingReminderNotifier::new();
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
        run_tick_with_notifier(&db.connection, cutoff, cutoff, &notifier);
        assert!(notifier.delivered_payloads().is_empty());
    }

    #[test]
    fn postpone_uses_new_snapshot_for_notification() {
        let db = open_test_database();
        let notifier = RecordingReminderNotifier::new();
        let cutoff = 10_000_000;
        let task =
            create_task_with_deadline(&db.connection, "提交方案", 10_000_000, 18_000_000, vec![]);

        run_tick_with_notifier(&db.connection, 14_400_000, cutoff, &notifier);
        TaskService::postpone(
            &db.connection,
            PostponeTaskRequest {
                task_id: task.id.clone(),
                new_deadline_at_ms: 20_000_000,
                reason: "delay".to_string(),
            },
        )
        .expect("postpone");

        run_tick_with_notifier(&db.connection, 16_400_000, cutoff, &notifier);
        let kinds: Vec<_> = notifier
            .delivered_payloads()
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
        assert_eq!(kinds[0], ("ddl_60".to_string(), 18_000_000));
        assert_eq!(kinds[1], ("ddl_60".to_string(), 20_000_000));
    }

    #[test]
    fn notification_content_distinguishes_custom_and_system() {
        let custom = build_notification_content(&ReminderTriggeredPayload::Custom {
            reminder_id: "r1".to_string(),
            task_id: "t1".to_string(),
            task_title: "提交方案".to_string(),
            remind_at_ms: 1,
            fired_at_ms: 2,
            message: None,
        });
        assert_eq!(custom.title, NOTIFICATION_TITLE);
        assert_eq!(custom.body, "「提交方案」该提醒啦");

        let ddl_60 = build_notification_content(&ReminderTriggeredPayload::System {
            task_id: "t1".to_string(),
            task_title: "提交方案".to_string(),
            reminder_kind: "ddl_60".to_string(),
            deadline_snapshot_ms: 1,
            trigger_at_ms: 2,
            fired_at_ms: 3,
        });
        assert_eq!(ddl_60.body, "「提交方案」距离 DDL 还有 1 小时");

        let ddl_due = build_notification_content(&ReminderTriggeredPayload::System {
            task_id: "t1".to_string(),
            task_title: "提交方案".to_string(),
            reminder_kind: "ddl_due".to_string(),
            deadline_snapshot_ms: 1,
            trigger_at_ms: 2,
            fired_at_ms: 3,
        });
        assert_eq!(ddl_due.body, "「提交方案」DDL 到啦");
    }

    #[test]
    fn notification_failure_does_not_block_engine_or_fired_fact() {
        let db = open_test_database();
        let notifier = RecordingReminderNotifier::new();
        notifier.set_fail_next(true);
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

        let tick = run_tick_with_notifier(&db.connection, 12_000, cutoff, &notifier);
        assert_eq!(tick.triggered.len(), 1);
        assert_eq!(
            ReminderRepository::count_unfired_at_or_before_cutoff(&db.connection, cutoff)
                .expect("count"),
            0
        );

        notifier.set_fail_next(false);
        let second = run_tick_with_notifier(&db.connection, 12_500, cutoff, &notifier);
        assert!(second.triggered.is_empty());
    }

    #[test]
    fn forced_notification_failure_does_not_crash_delivery_loop() {
        let notifier = RecordingReminderNotifier::new();
        notifier.set_fail_next(true);
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
        notifier.set_fail_next(true);
        deliver_triggered_reminders(&notifier, &payloads);
        assert!(notifier.delivered_payloads().is_empty());
    }
}
