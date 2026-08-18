use std::sync::atomic::{AtomicBool, Ordering};
use std::thread;
use std::time::Duration;

use chrono::Local;
use tauri::{AppHandle, Emitter, Manager};

use crate::errors::AppError;
use crate::services::overtime::OvertimeService;
use crate::services::reminder_attention::{deliver_triggered_attention, TauriReminderAttention};
use crate::services::reminder_engine::REMINDER_TRIGGERED_EVENT;
use crate::services::reminder_notifier::{deliver_triggered_reminders, TauriReminderNotifier};
use crate::services::reminder_window::{
    deliver_triggered_reminder_window, TauriReminderWindowPresenter,
};
use crate::services::workspace_switch::AppState;

pub const RUNTIME_CHECK_INTERVAL: Duration = Duration::from_secs(30);

static RUNTIME_CHECKER_STARTED: AtomicBool = AtomicBool::new(false);

pub fn try_acquire_runtime_checker() -> bool {
    !RUNTIME_CHECKER_STARTED.swap(true, Ordering::SeqCst)
}

pub fn reconcile_runtime_tick(app: &AppHandle, now_ms: i64) -> Result<bool, AppError> {
    let state = app.state::<AppState>();
    state.with_db_app(|connection| OvertimeService::reconcile_at(connection, now_ms))
}

pub fn reminder_runtime_tick(app: &AppHandle, now_ms: i64) -> Result<(), AppError> {
    let state = app.state::<AppState>();
    let tick = state.run_reminder_tick(now_ms)?;
    let notifier = TauriReminderNotifier::new(app.clone());
    let attention = TauriReminderAttention::new(app.clone());
    let window = TauriReminderWindowPresenter::new(app.clone());
    for payload in &tick.triggered {
        let _ = app.emit(REMINDER_TRIGGERED_EVENT, payload);
    }
    deliver_triggered_reminders(&notifier, &tick.triggered);
    deliver_triggered_attention(&attention, &tick.triggered);
    deliver_triggered_reminder_window(&window, &tick.triggered);
    Ok(())
}

pub fn runtime_tick(app: &AppHandle, now_ms: i64) {
    let _ = reconcile_runtime_tick(app, now_ms);
    let _ = reminder_runtime_tick(app, now_ms);
}

pub fn start_runtime_checker(app: AppHandle) {
    if !try_acquire_runtime_checker() {
        return;
    }

    thread::spawn(move || loop {
        thread::sleep(RUNTIME_CHECK_INTERVAL);
        let now_ms = Local::now().timestamp_millis();
        runtime_tick(&app, now_ms);
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::overtime_repository::OvertimeRepository;
    use crate::db::repositories::settings_repository::SettingsRepository;
    use crate::services::overtime::{OvertimeService, END_TYPE_AUTO, END_TYPE_MANUAL};
    use crate::services::work_status::WorkStatusService;
    use chrono::{Local, NaiveDateTime, TimeZone};

    fn local_ms(date: &str, time: &str) -> i64 {
        let naive = NaiveDateTime::parse_from_str(&format!("{date} {time}"), "%Y-%m-%d %H:%M")
            .expect("valid");
        Local
            .from_local_datetime(&naive)
            .single()
            .expect("valid local datetime")
            .timestamp_millis()
    }

    #[test]
    fn runtime_checker_start_guard_is_idempotent() {
        let local = AtomicBool::new(false);
        assert!(try_acquire_local(&local));
        assert!(!try_acquire_local(&local));
    }

    fn try_acquire_local(flag: &AtomicBool) -> bool {
        !flag.swap(true, Ordering::SeqCst)
    }

    #[test]
    fn runtime_reconcile_delegates_to_shared_reconcile_at() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize");
        SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "20:00");
        let auto_end_ms = local_ms("2026-08-15", "05:00");
        let tick_ms = local_ms("2026-08-15", "05:01");

        OvertimeService::start(&connection, start_ms).expect("start");

        let ended = OvertimeService::reconcile_at(&connection, tick_ms).expect("tick");
        assert!(ended);

        let end_at_ms: i64 = connection
            .query_row(
                "SELECT end_at_ms FROM overtime_records LIMIT 1",
                [],
                |row| row.get(0),
            )
            .expect("end_at_ms");
        assert_eq!(end_at_ms, auto_end_ms);
        assert_ne!(end_at_ms, tick_ms);
    }

    #[test]
    fn runtime_then_startup_reconcile_is_no_op() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize");
        SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "20:00");
        let reopen_ms = local_ms("2026-08-15", "09:00");

        OvertimeService::start(&connection, start_ms).expect("start");
        assert!(OvertimeService::reconcile_at(&connection, reopen_ms).expect("runtime"));

        let second =
            OvertimeService::reconcile_at_startup(&connection, reopen_ms).expect("startup");
        assert_eq!(second, ());

        let end_type: String = connection
            .query_row("SELECT end_type FROM overtime_records LIMIT 1", [], |row| {
                row.get(0)
            })
            .expect("end_type");
        assert_eq!(end_type, END_TYPE_AUTO);
    }

    #[test]
    fn startup_then_runtime_reconcile_is_no_op() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize");
        SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "20:00");
        let reopen_ms = local_ms("2026-08-15", "09:00");

        OvertimeService::start(&connection, start_ms).expect("start");
        OvertimeService::reconcile_at_startup(&connection, reopen_ms).expect("startup");

        let ended = OvertimeService::reconcile_at(&connection, reopen_ms).expect("runtime");
        assert!(!ended);
    }

    #[test]
    fn runtime_reconcile_respects_manual_end() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize");
        SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "19:00");
        let manual_end_ms = local_ms("2026-08-14", "21:00");
        let tick_ms = local_ms("2026-08-15", "05:00");

        OvertimeService::start(&connection, start_ms).expect("start");
        OvertimeService::end_manual(&connection, manual_end_ms).expect("manual end");

        let ended = OvertimeService::reconcile_at(&connection, tick_ms).expect("tick");
        assert!(!ended);

        let row = connection
            .query_row(
                "SELECT end_at_ms, end_type FROM overtime_records LIMIT 1",
                [],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
            )
            .expect("row");
        assert_eq!(row.0, manual_end_ms);
        assert_eq!(row.1, END_TYPE_MANUAL);
    }

    #[test]
    fn repeated_runtime_reconcile_is_idempotent() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize");
        SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "20:00");
        let tick_ms = local_ms("2026-08-15", "05:01");

        OvertimeService::start(&connection, start_ms).expect("start");
        assert!(OvertimeService::reconcile_at(&connection, tick_ms).expect("first"));
        assert!(!OvertimeService::reconcile_at(&connection, tick_ms).expect("second"));
    }

    #[test]
    fn runtime_reconcile_closes_overtime_work_status_at_auto_end() {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize");
        SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "20:00");
        let auto_end_ms = local_ms("2026-08-15", "05:00");
        let tick_ms = local_ms("2026-08-15", "05:01");

        OvertimeService::start(&connection, start_ms).expect("start");
        OvertimeService::reconcile_at(&connection, tick_ms).expect("tick");

        assert!(WorkStatusService::get_current(&connection)
            .expect("current")
            .is_none());

        let status_end_at_ms: i64 = connection
            .query_row(
                "SELECT end_at_ms FROM work_status_records WHERE status_type = 'overtime'",
                [],
                |row| row.get(0),
            )
            .expect("status end");
        assert_eq!(status_end_at_ms, auto_end_ms);

        assert!(OvertimeRepository::get_active_record(&connection)
            .expect("query")
            .is_none());
    }
}
