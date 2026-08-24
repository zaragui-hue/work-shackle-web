use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, Runtime, WebviewUrl, WebviewWindowBuilder};

use super::reminder_engine::ReminderTriggeredPayload;

pub const REMINDER_WINDOW_LABEL: &str = "ddl-reminder";
pub const REMINDER_WINDOW_SHOW_EVENT: &str = "reminder://window-show";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderWindowShowPayload {
    pub primary: ReminderTriggeredPayload,
    pub additional_count: usize,
}

pub trait ReminderWindowPresenter: Send + Sync {
    fn present(&self, payload: &ReminderWindowShowPayload) -> Result<(), String>;
}

pub struct TauriReminderWindowPresenter<R: Runtime> {
    app: AppHandle<R>,
}

impl<R: Runtime> TauriReminderWindowPresenter<R> {
    pub fn new(app: AppHandle<R>) -> Self {
        Self { app }
    }
}

impl<R: Runtime> ReminderWindowPresenter for TauriReminderWindowPresenter<R> {
    fn present(&self, payload: &ReminderWindowShowPayload) -> Result<(), String> {
        let window = ensure_reminder_window(&self.app)?;
        window
            .emit(REMINDER_WINDOW_SHOW_EVENT, payload)
            .map_err(|error| error.to_string())?;
        window
            .set_always_on_top(true)
            .map_err(|error| error.to_string())?;
        window.show().map_err(|error| error.to_string())?;
        if let Err(error) = window.set_focus() {
            eprintln!("reminder window focus failed: {error}");
        }
        Ok(())
    }
}

pub fn reminder_urgency(payload: &ReminderTriggeredPayload) -> u8 {
    match payload {
        ReminderTriggeredPayload::System { reminder_kind, .. } => match reminder_kind.as_str() {
            "one_hour_remaining" => 100,
            "quarter_remaining" => 90,
            "progress_half" => 70,
            "ddl_due" => 100,
            "ddl_10" => 90,
            "ddl_30" => 80,
            "ddl_60" => 60,
            _ => 50,
        },
        ReminderTriggeredPayload::Custom { .. } => 75,
    }
}

fn urgency_tie_break_ms(payload: &ReminderTriggeredPayload) -> i64 {
    match payload {
        ReminderTriggeredPayload::Custom { remind_at_ms, .. } => *remind_at_ms,
        ReminderTriggeredPayload::System {
            trigger_at_ms,
            deadline_snapshot_ms,
            ..
        } => trigger_at_ms.saturating_add(*deadline_snapshot_ms),
    }
}

pub fn build_window_presentation(
    triggered: &[ReminderTriggeredPayload],
) -> ReminderWindowShowPayload {
    let mut sorted: Vec<ReminderTriggeredPayload> = triggered.to_vec();
    sorted.sort_by(|left, right| {
        reminder_urgency(right)
            .cmp(&reminder_urgency(left))
            .then_with(|| urgency_tie_break_ms(left).cmp(&urgency_tie_break_ms(right)))
            .then_with(|| task_id(left).cmp(task_id(right)))
    });

    ReminderWindowShowPayload {
        primary: sorted
            .first()
            .cloned()
            .expect("triggered slice is non-empty"),
        additional_count: sorted.len().saturating_sub(1),
    }
}

fn task_id(payload: &ReminderTriggeredPayload) -> &str {
    match payload {
        ReminderTriggeredPayload::Custom { task_id, .. } => task_id,
        ReminderTriggeredPayload::System { task_id, .. } => task_id,
    }
}

fn ensure_reminder_window<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri::WebviewWindow<R>, String> {
    if let Some(window) = app.get_webview_window(REMINDER_WINDOW_LABEL) {
        return Ok(window);
    }

    WebviewWindowBuilder::new(
        app,
        REMINDER_WINDOW_LABEL,
        WebviewUrl::App("index.html".into()),
    )
    .title("Work Shackle 提醒")
    .inner_size(520.0, 520.0)
    .min_inner_size(520.0, 520.0)
    .resizable(false)
    .always_on_top(true)
    .center()
    .visible(false)
    .build()
    .map_err(|error| error.to_string())
}

pub fn deliver_triggered_reminder_window(
    presenter: &dyn ReminderWindowPresenter,
    triggered: &[ReminderTriggeredPayload],
) {
    if triggered.is_empty() {
        return;
    }

    let presentation = build_window_presentation(triggered);
    if let Err(error) = presenter.present(&presentation) {
        eprintln!("reminder window failed: {error}");
    }
}

#[derive(Default)]
pub struct RecordingReminderWindowPresenter {
    presented: Mutex<Vec<ReminderWindowShowPayload>>,
    fail_next: Mutex<bool>,
}

impl RecordingReminderWindowPresenter {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn set_fail_next(&self, fail: bool) {
        *self.fail_next.lock().expect("lock fail_next") = fail;
    }

    pub fn presented_payloads(&self) -> Vec<ReminderWindowShowPayload> {
        self.presented.lock().expect("lock presented").clone()
    }
}

impl ReminderWindowPresenter for RecordingReminderWindowPresenter {
    fn present(&self, payload: &ReminderWindowShowPayload) -> Result<(), String> {
        if *self.fail_next.lock().expect("lock fail_next") {
            return Err("forced reminder window failure".to_string());
        }
        self.presented
            .lock()
            .expect("lock presented")
            .push(payload.clone());
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::settings_repository::SettingsRepository;
    use crate::services::reminder_attention::{
        deliver_triggered_attention, RecordingReminderAttention,
    };
    use crate::services::reminder_engine::ReminderEngineService;
    use crate::services::reminder_notifier::{
        deliver_triggered_reminders, RecordingReminderNotifier,
    };
    use crate::services::task::{CreateTaskReminderRequest, CreateTaskRequest, TaskService};

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

    fn custom_payload(task_id: &str, title: &str) -> ReminderTriggeredPayload {
        ReminderTriggeredPayload::Custom {
            reminder_id: "r1".to_string(),
            task_id: task_id.to_string(),
            task_title: title.to_string(),
            remind_at_ms: 12_000,
            fired_at_ms: 12_000,
            message: None,
        }
    }

    fn system_payload(task_id: &str, title: &str, kind: &str) -> ReminderTriggeredPayload {
        ReminderTriggeredPayload::System {
            task_id: task_id.to_string(),
            task_title: title.to_string(),
            reminder_kind: kind.to_string(),
            deadline_snapshot_ms: 20_000,
            trigger_at_ms: 12_000,
            fired_at_ms: 12_000,
        }
    }

    #[test]
    fn urgency_prefers_ddl_due_over_other_kinds() {
        let triggered = vec![
            system_payload("a", "A", "ddl_60"),
            system_payload("b", "B", "ddl_due"),
            custom_payload("c", "C"),
        ];
        let presentation = build_window_presentation(&triggered);
        assert!(matches!(
            presentation.primary,
            ReminderTriggeredPayload::System {
                reminder_kind,
                ..
            } if reminder_kind == "ddl_due"
        ));
        assert_eq!(presentation.additional_count, 2);
    }

    #[test]
    fn urgency_orders_ddl_10_above_ddl_30_and_custom() {
        let triggered = vec![
            system_payload("a", "A", "ddl_30"),
            custom_payload("b", "B"),
            system_payload("c", "C", "ddl_10"),
        ];
        let presentation = build_window_presentation(&triggered);
        assert!(matches!(
            presentation.primary,
            ReminderTriggeredPayload::System {
                reminder_kind,
                ..
            } if reminder_kind == "ddl_10"
        ));
        assert_eq!(presentation.additional_count, 2);
    }

    #[test]
    fn custom_reminder_fire_presents_window_once() {
        let db = open_test_database();
        let window = RecordingReminderWindowPresenter::new();
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

        let tick = ReminderEngineService::tick(&db.connection, 12_000, cutoff).expect("tick");
        deliver_triggered_reminder_window(&window, &tick.triggered);
        assert_eq!(window.presented_payloads().len(), 1);

        let tick2 = ReminderEngineService::tick(&db.connection, 12_500, cutoff).expect("tick2");
        deliver_triggered_reminder_window(&window, &tick2.triggered);
        assert_eq!(window.presented_payloads().len(), 1);
    }

    #[test]
    fn system_ddl_window_presents_once_per_kind() {
        let db = open_test_database();
        let window = RecordingReminderWindowPresenter::new();
        let cutoff = 10_000;
        create_task_with_deadline(&db.connection, "提交方案", 1_000, 10_800_000, vec![]);

        for now_ms in [7_200_000, 9_000_000, 10_200_000, 10_800_000] {
            let tick = ReminderEngineService::tick(&db.connection, now_ms, cutoff).expect("tick");
            deliver_triggered_reminder_window(&window, &tick.triggered);
        }

        let kinds: Vec<_> = window
            .presented_payloads()
            .into_iter()
            .filter_map(|payload| match payload.primary {
                ReminderTriggeredPayload::System { reminder_kind, .. } => Some(reminder_kind),
                _ => None,
            })
            .collect();
        assert_eq!(
            kinds,
            vec![
                "one_hour_remaining".to_string(),
                "quarter_remaining".to_string(),
            ]
        );
    }

    #[test]
    fn future_reminder_does_not_present_window() {
        let db = open_test_database();
        let window = RecordingReminderWindowPresenter::new();
        let cutoff = 10_000;
        create_task_with_deadline(
            &db.connection,
            "future",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );

        let tick = ReminderEngineService::tick(&db.connection, 11_000, cutoff).expect("tick");
        deliver_triggered_reminder_window(&window, &tick.triggered);
        assert!(window.presented_payloads().is_empty());
    }

    #[test]
    fn startup_cutoff_skips_historical_window_presentation() {
        let db = open_test_database();
        let window = RecordingReminderWindowPresenter::new();
        let cutoff = 15_000;
        create_task_with_deadline(
            &db.connection,
            "historical",
            1_000,
            20_000,
            vec![CreateTaskReminderRequest {
                remind_at_ms: 12_000,
                message: None,
            }],
        );

        let tick = ReminderEngineService::tick(&db.connection, 16_000, cutoff).expect("tick");
        deliver_triggered_reminder_window(&window, &tick.triggered);
        assert!(window.presented_payloads().is_empty());
    }

    #[test]
    fn completed_task_does_not_present_future_window() {
        let db = open_test_database();
        let window = RecordingReminderWindowPresenter::new();
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

        let tick = ReminderEngineService::tick(&db.connection, 12_000, cutoff).expect("tick");
        deliver_triggered_reminder_window(&window, &tick.triggered);
        assert!(window.presented_payloads().is_empty());
    }

    #[test]
    fn single_tick_multiple_due_reminders_present_primary_with_count() {
        let db = open_test_database();
        let window = RecordingReminderWindowPresenter::new();
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

        let tick = ReminderEngineService::tick(&db.connection, 9_000_000, cutoff).expect("tick");
        assert_eq!(tick.triggered.len(), 3);
        deliver_triggered_reminder_window(&window, &tick.triggered);
        assert_eq!(window.presented_payloads().len(), 1);
        assert_eq!(window.presented_payloads()[0].additional_count, 2);
    }

    #[test]
    fn window_failure_does_not_block_notification_or_attention() {
        let db = open_test_database();
        let window = RecordingReminderWindowPresenter::new();
        window.set_fail_next(true);
        let notifier = RecordingReminderNotifier::new();
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

        let tick = ReminderEngineService::tick(&db.connection, 12_000, cutoff).expect("tick");
        deliver_triggered_reminder_window(&window, &tick.triggered);
        deliver_triggered_reminders(&notifier, &tick.triggered);
        deliver_triggered_attention(&attention, &tick.triggered);

        assert!(window.presented_payloads().is_empty());
        assert_eq!(notifier.delivered_payloads().len(), 1);
        assert_eq!(attention.requested_payloads().len(), 1);
    }
}
