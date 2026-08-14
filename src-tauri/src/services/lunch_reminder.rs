use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::lunch_reminder_repository::{
    LunchReminderRepository, LunchReminderRepositoryError,
};
use crate::db::repositories::settings_repository::SettingsRepository;
use crate::errors::AppError;
use crate::time::calendar_day::{format_work_date, local_date_from_ms};
use crate::time::clock_time::{is_local_time_in_half_open_range, ClockTimeError};

pub const LUNCH_REMINDER_MESSAGE: &str = "到饭点了。工作可以等等，饭凉了是真的不好吃。";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LunchReminderDto {
    pub message: String,
    pub reminder_date: String,
    pub lunch_start: String,
    pub lunch_end: String,
}

pub struct LunchReminderService;

impl LunchReminderService {
    pub fn check(
        connection: &Connection,
        now_ms: i64,
    ) -> Result<Option<LunchReminderDto>, AppError> {
        SettingsRepository::ensure_defaults(connection, now_ms).map_err(map_settings_error)?;
        let settings = SettingsRepository::get_settings(connection).map_err(map_settings_error)?;

        if !is_local_time_in_half_open_range(now_ms, &settings.lunch_start, &settings.lunch_end)
            .map_err(map_clock_time_error)?
        {
            return Ok(None);
        }

        let reminder_date = local_date_from_ms(now_ms);
        let reminder = LunchReminderDto {
            message: LUNCH_REMINDER_MESSAGE.to_string(),
            reminder_date: format_work_date(reminder_date),
            lunch_start: settings.lunch_start.clone(),
            lunch_end: settings.lunch_end.clone(),
        };

        connection
            .execute("BEGIN IMMEDIATE", [])
            .map_err(|error| AppError::DatabaseError {
                message: error.to_string(),
            })?;

        let fired = (|| -> Result<bool, AppError> {
            if LunchReminderRepository::has_fired_for_reminder_date(connection, reminder_date)
                .map_err(map_lunch_reminder_error)?
            {
                return Ok(false);
            }

            if !is_local_time_in_half_open_range(now_ms, &settings.lunch_start, &settings.lunch_end)
                .map_err(map_clock_time_error)?
            {
                return Ok(false);
            }

            LunchReminderRepository::mark_fired(connection, reminder_date, now_ms)
                .map_err(map_lunch_reminder_error)?;
            Ok(true)
        })();

        match fired {
            Ok(should_return) => {
                connection
                    .execute("COMMIT", [])
                    .map_err(|error| AppError::DatabaseError {
                        message: error.to_string(),
                    })?;
                if should_return {
                    Ok(Some(reminder))
                } else {
                    Ok(None)
                }
            }
            Err(error) => {
                let _ = connection.execute("ROLLBACK", []);
                Err(error)
            }
        }
    }
}

fn map_clock_time_error(error: ClockTimeError) -> AppError {
    AppError::InvalidTaskInput {
        message: error.to_string(),
    }
}

fn map_settings_error(
    error: crate::db::repositories::settings_repository::SettingsRepositoryError,
) -> AppError {
    match error {
        crate::db::repositories::settings_repository::SettingsRepositoryError::InvalidInput {
            message,
        } => AppError::InvalidTaskInput { message },
        crate::db::repositories::settings_repository::SettingsRepositoryError::Db(db_error) => {
            AppError::DatabaseError {
                message: db_error.to_string(),
            }
        }
    }
}

fn map_lunch_reminder_error(error: LunchReminderRepositoryError) -> AppError {
    match error {
        LunchReminderRepositoryError::InvalidInput { message } => {
            AppError::InvalidTaskInput { message }
        }
        LunchReminderRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::lunch_reminder_repository::LunchReminderRepository;
    use crate::db::repositories::settings_repository::{
        SettingsRepository, DEFAULT_LUNCH_END, DEFAULT_LUNCH_START,
    };
    use crate::services::settings::{SaveLunchTimesRequest, SettingsService};
    use crate::services::work_status::{SwitchWorkStatusRequest, WorkStatusService};
    use chrono::{Local, NaiveDateTime, TimeZone};

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
    fn does_not_trigger_before_lunch_start() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        let reminder = LunchReminderService::check(&db.connection, local_ms("2026-08-14", "11:59"))
            .expect("check");
        assert!(reminder.is_none());
    }

    #[test]
    fn triggers_at_lunch_start() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        let reminder = LunchReminderService::check(&db.connection, local_ms("2026-08-14", "12:00"))
            .expect("check")
            .expect("reminder");

        assert_eq!(reminder.message, LUNCH_REMINDER_MESSAGE);
        assert_eq!(reminder.lunch_start, DEFAULT_LUNCH_START);
        assert_eq!(reminder.lunch_end, DEFAULT_LUNCH_END);
        assert_eq!(reminder.reminder_date, "2026-08-14");
    }

    #[test]
    fn opening_app_mid_lunch_window_fires_once_if_not_yet_fired() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        let reminder = LunchReminderService::check(&db.connection, local_ms("2026-08-14", "12:30"))
            .expect("check")
            .expect("reminder");
        assert_eq!(reminder.reminder_date, "2026-08-14");
    }

    #[test]
    fn does_not_trigger_at_lunch_end() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        let reminder = LunchReminderService::check(&db.connection, local_ms("2026-08-14", "13:00"))
            .expect("check");
        assert!(reminder.is_none());
    }

    #[test]
    fn does_not_trigger_after_lunch_end() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        assert!(
            LunchReminderService::check(&db.connection, local_ms("2026-08-14", "13:01"))
                .expect("after end")
                .is_none()
        );
        assert!(
            LunchReminderService::check(&db.connection, local_ms("2026-08-14", "20:00"))
                .expect("evening")
                .is_none()
        );
    }

    #[test]
    fn triggers_once_per_local_calendar_day() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        LunchReminderService::check(&db.connection, local_ms("2026-08-14", "12:05"))
            .expect("first")
            .expect("first reminder");
        let second = LunchReminderService::check(&db.connection, local_ms("2026-08-14", "12:30"))
            .expect("second");
        assert!(second.is_none());
    }

    #[test]
    fn can_trigger_again_on_next_local_calendar_day() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        LunchReminderService::check(&db.connection, local_ms("2026-08-14", "12:00"))
            .expect("day one")
            .expect("first reminder");

        let next_day = LunchReminderService::check(&db.connection, local_ms("2026-08-15", "12:00"))
            .expect("day two")
            .expect("second day reminder");
        assert_eq!(next_day.reminder_date, "2026-08-15");
    }

    #[test]
    fn early_morning_uses_current_local_calendar_date_not_work_date() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        LunchReminderService::check(&db.connection, local_ms("2026-08-14", "12:00"))
            .expect("day one")
            .expect("first reminder");

        let early_next_day =
            LunchReminderService::check(&db.connection, local_ms("2026-08-15", "02:00"))
                .expect("early morning");
        assert!(early_next_day.is_none());

        let lunch_next_day =
            LunchReminderService::check(&db.connection, local_ms("2026-08-15", "12:30"))
                .expect("next lunch")
                .expect("next day reminder");
        assert_eq!(lunch_next_day.reminder_date, "2026-08-15");
    }

    #[test]
    fn missed_lunch_window_does_not_catch_up_at_night() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        let reminder = LunchReminderService::check(&db.connection, local_ms("2026-08-14", "21:00"))
            .expect("night");
        assert!(reminder.is_none());
        assert!(!LunchReminderRepository::has_fired_for_reminder_date(
            &db.connection,
            chrono::NaiveDate::from_ymd_opt(2026, 8, 14).expect("date")
        )
        .expect("has fired"));
    }

    #[test]
    fn does_not_auto_change_work_status() {
        let db = open_test_database();
        WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "working".to_string(),
            },
        )
        .expect("switch");

        LunchReminderService::check(&db.connection, local_ms("2026-08-14", "12:00"))
            .expect("check");

        let current = WorkStatusService::get_current(&db.connection)
            .expect("current")
            .expect("active");
        assert_eq!(current.status_type, "working");
    }

    #[test]
    fn dedup_survives_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();

        {
            let connection = initialize_database(workspace).expect("initialize");
            SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
            LunchReminderService::check(&connection, local_ms("2026-08-14", "12:00"))
                .expect("check")
                .expect("reminder");
        }

        let reopened = initialize_database(workspace).expect("reopen");
        let second = LunchReminderService::check(&reopened, local_ms("2026-08-14", "12:30"))
            .expect("second check");
        assert!(second.is_none());
    }

    #[test]
    fn lunch_times_save_and_read() {
        let db = open_test_database();
        let saved = SettingsService::save_lunch_times(
            &db.connection,
            SaveLunchTimesRequest {
                lunch_start: "11:30".to_string(),
                lunch_end: "12:30".to_string(),
            },
        )
        .expect("save");

        assert_eq!(saved.lunch_start, "11:30");
        assert_eq!(saved.lunch_end, "12:30");
    }

    #[test]
    fn lunch_start_not_before_end_is_rejected() {
        let db = open_test_database();
        let err = SettingsService::save_lunch_times(
            &db.connection,
            SaveLunchTimesRequest {
                lunch_start: "13:00".to_string(),
                lunch_end: "12:00".to_string(),
            },
        )
        .expect_err("invalid range");
        assert!(matches!(err, AppError::InvalidTaskInput { .. }));
    }

    #[test]
    fn custom_lunch_window_is_respected_for_trigger() {
        let db = open_test_database();
        SettingsService::save_lunch_times(
            &db.connection,
            SaveLunchTimesRequest {
                lunch_start: "11:30".to_string(),
                lunch_end: "12:30".to_string(),
            },
        )
        .expect("save");

        assert!(
            LunchReminderService::check(&db.connection, local_ms("2026-08-14", "11:29"))
                .expect("before")
                .is_none()
        );
        assert!(
            LunchReminderService::check(&db.connection, local_ms("2026-08-14", "11:30"))
                .expect("at start")
                .is_some()
        );

        let end_boundary_db = open_test_database();
        SettingsService::save_lunch_times(
            &end_boundary_db.connection,
            SaveLunchTimesRequest {
                lunch_start: "11:30".to_string(),
                lunch_end: "12:30".to_string(),
            },
        )
        .expect("save");
        assert!(LunchReminderService::check(
            &end_boundary_db.connection,
            local_ms("2026-08-14", "12:29")
        )
        .expect("inside window")
        .is_some());
        let after_end_db = open_test_database();
        SettingsService::save_lunch_times(
            &after_end_db.connection,
            SaveLunchTimesRequest {
                lunch_start: "11:30".to_string(),
                lunch_end: "12:30".to_string(),
            },
        )
        .expect("save");
        assert!(LunchReminderService::check(
            &after_end_db.connection,
            local_ms("2026-08-14", "12:30")
        )
        .expect("at end")
        .is_none());
    }

    #[test]
    fn lunch_settings_survive_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();

        {
            let connection = initialize_database(workspace).expect("initialize");
            SettingsService::save_lunch_times(
                &connection,
                SaveLunchTimesRequest {
                    lunch_start: "11:45".to_string(),
                    lunch_end: "12:45".to_string(),
                },
            )
            .expect("save");
        }

        let reopened = initialize_database(workspace).expect("reopen");
        let settings = SettingsRepository::get_settings(&reopened).expect("settings");
        assert_eq!(settings.lunch_start, "11:45");
        assert_eq!(settings.lunch_end, "12:45");
    }
}
