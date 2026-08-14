use chrono::{Local, NaiveDate};
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::settings_repository::{SettingsRepository, SettingsRepositoryError};
use crate::errors::AppError;
use crate::time::calendar_day::format_work_date;
use crate::time::clock_time::{normalize_clock_time, validate_work_time_range, ClockTimeError};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkScheduleDto {
    pub work_date: String,
    pub default_start: String,
    pub default_end: String,
    pub effective_start: String,
    pub effective_end: String,
    pub has_today_override: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveWorkTimesRequest {
    pub start_time: String,
    pub end_time: String,
}

pub struct SettingsService;

impl SettingsService {
    pub fn get_work_schedule(
        connection: &Connection,
        work_date: NaiveDate,
    ) -> Result<WorkScheduleDto, AppError> {
        let now_ms = now_ms();
        SettingsRepository::ensure_defaults(connection, now_ms).map_err(map_settings_error)?;
        let settings = SettingsRepository::get_settings(connection).map_err(map_settings_error)?;
        let override_row =
            SettingsRepository::get_override(connection, work_date).map_err(map_settings_error)?;

        let (effective_start, effective_end, has_today_override) = match override_row {
            Some(override_row) => (override_row.start_time, override_row.end_time, true),
            None => (
                settings.default_work_start.clone(),
                settings.default_work_end.clone(),
                false,
            ),
        };

        Ok(WorkScheduleDto {
            work_date: format_work_date(work_date),
            default_start: settings.default_work_start,
            default_end: settings.default_work_end,
            effective_start,
            effective_end,
            has_today_override,
        })
    }

    pub fn save_default_work_times(
        connection: &Connection,
        input: SaveWorkTimesRequest,
    ) -> Result<WorkScheduleDto, AppError> {
        let (start_time, end_time) = normalize_and_validate(&input.start_time, &input.end_time)?;
        let now_ms = now_ms();
        SettingsRepository::ensure_defaults(connection, now_ms).map_err(map_settings_error)?;
        SettingsRepository::update_default_work_times(connection, &start_time, &end_time, now_ms)
            .map_err(map_settings_error)?;

        Self::get_work_schedule(connection, Local::now().date_naive())
    }

    pub fn save_today_work_override(
        connection: &Connection,
        input: SaveWorkTimesRequest,
    ) -> Result<WorkScheduleDto, AppError> {
        let (start_time, end_time) = normalize_and_validate(&input.start_time, &input.end_time)?;
        let today = Local::now().date_naive();
        let now_ms = now_ms();
        SettingsRepository::ensure_defaults(connection, now_ms).map_err(map_settings_error)?;
        SettingsRepository::upsert_override(connection, today, &start_time, &end_time)
            .map_err(map_settings_error)?;

        Self::get_work_schedule(connection, today)
    }

    pub fn clear_today_work_override(connection: &Connection) -> Result<WorkScheduleDto, AppError> {
        let today = Local::now().date_naive();
        let now_ms = now_ms();
        SettingsRepository::ensure_defaults(connection, now_ms).map_err(map_settings_error)?;
        SettingsRepository::delete_override(connection, today).map_err(map_settings_error)?;

        Self::get_work_schedule(connection, today)
    }
}

fn normalize_and_validate(start: &str, end: &str) -> Result<(String, String), AppError> {
    let start_time = normalize_clock_time(start).map_err(map_clock_time_error)?;
    let end_time = normalize_clock_time(end).map_err(map_clock_time_error)?;
    validate_work_time_range(&start_time, &end_time).map_err(map_clock_time_error)?;
    Ok((start_time, end_time))
}

fn now_ms() -> i64 {
    Local::now().timestamp_millis()
}

fn map_clock_time_error(error: ClockTimeError) -> AppError {
    AppError::InvalidTaskInput {
        message: error.to_string(),
    }
}

fn map_settings_error(error: SettingsRepositoryError) -> AppError {
    match error {
        SettingsRepositoryError::InvalidInput { message } => AppError::InvalidTaskInput { message },
        SettingsRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::settings_repository::{
        SettingsRepository, DEFAULT_WORK_END, DEFAULT_WORK_START,
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

    fn test_day() -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 8, 14).expect("date")
    }

    fn tomorrow(day: NaiveDate) -> NaiveDate {
        day.succ_opt().expect("tomorrow")
    }

    #[test]
    fn default_work_times_save_and_read() {
        let db = open_test_database();
        let saved = SettingsService::save_default_work_times(
            &db.connection,
            SaveWorkTimesRequest {
                start_time: "09:30".to_string(),
                end_time: "18:30".to_string(),
            },
        )
        .expect("save default");

        assert_eq!(saved.default_start, "09:30");
        assert_eq!(saved.default_end, "18:30");
        assert_eq!(saved.effective_start, "09:30");
        assert_eq!(saved.effective_end, "18:30");
        assert!(!saved.has_today_override);
    }

    #[test]
    fn start_not_before_end_is_rejected() {
        let db = open_test_database();
        let err = SettingsService::save_default_work_times(
            &db.connection,
            SaveWorkTimesRequest {
                start_time: "18:30".to_string(),
                end_time: "09:30".to_string(),
            },
        )
        .expect_err("invalid range");

        assert!(matches!(err, AppError::InvalidTaskInput { .. }));

        let equal_err = SettingsService::save_today_work_override(
            &db.connection,
            SaveWorkTimesRequest {
                start_time: "09:30".to_string(),
                end_time: "09:30".to_string(),
            },
        )
        .expect_err("equal range");
        assert!(matches!(equal_err, AppError::InvalidTaskInput { .. }));
    }

    #[test]
    fn without_override_effective_times_use_default() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let schedule =
            SettingsService::get_work_schedule(&db.connection, test_day()).expect("schedule");

        assert_eq!(schedule.default_start, DEFAULT_WORK_START);
        assert_eq!(schedule.default_end, DEFAULT_WORK_END);
        assert_eq!(schedule.effective_start, DEFAULT_WORK_START);
        assert_eq!(schedule.effective_end, DEFAULT_WORK_END);
        assert!(!schedule.has_today_override);
    }

    #[test]
    fn override_for_date_returns_override_times() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        SettingsRepository::upsert_override(&db.connection, test_day(), "10:00", "20:00")
            .expect("override");

        let schedule =
            SettingsService::get_work_schedule(&db.connection, test_day()).expect("schedule");
        assert_eq!(schedule.effective_start, "10:00");
        assert_eq!(schedule.effective_end, "20:00");
        assert!(schedule.has_today_override);
    }

    #[test]
    fn tomorrow_query_returns_default_even_when_today_has_override() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let today = test_day();
        SettingsRepository::upsert_override(&db.connection, today, "10:00", "20:00")
            .expect("override");

        let tomorrow_schedule =
            SettingsService::get_work_schedule(&db.connection, tomorrow(today)).expect("tomorrow");
        assert_eq!(tomorrow_schedule.effective_start, DEFAULT_WORK_START);
        assert_eq!(tomorrow_schedule.effective_end, DEFAULT_WORK_END);
        assert!(!tomorrow_schedule.has_today_override);
    }

    #[test]
    fn clear_today_override_restores_default_effective_times() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let today = Local::now().date_naive();
        SettingsRepository::upsert_override(&db.connection, today, "10:00", "20:00")
            .expect("override");

        SettingsService::clear_today_work_override(&db.connection).expect("clear");

        let schedule = SettingsService::get_work_schedule(&db.connection, today).expect("schedule");
        assert_eq!(schedule.effective_start, DEFAULT_WORK_START);
        assert_eq!(schedule.effective_end, DEFAULT_WORK_END);
        assert!(!schedule.has_today_override);
    }

    #[test]
    fn default_work_times_survive_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();

        {
            let connection = initialize_database(workspace).expect("initialize");
            SettingsService::save_default_work_times(
                &connection,
                SaveWorkTimesRequest {
                    start_time: "09:30".to_string(),
                    end_time: "18:30".to_string(),
                },
            )
            .expect("save");
        }

        let reopened = initialize_database(workspace).expect("reopen");
        let settings = SettingsRepository::get_settings(&reopened).expect("settings");
        assert_eq!(settings.default_work_start, "09:30");
        assert_eq!(settings.default_work_end, "18:30");
    }

    #[test]
    fn today_override_survives_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();
        let day = test_day();

        {
            let connection = initialize_database(workspace).expect("initialize");
            SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
            SettingsRepository::upsert_override(&connection, day, "10:00", "20:00")
                .expect("override");
        }

        let reopened = initialize_database(workspace).expect("reopen");
        let schedule = SettingsService::get_work_schedule(&reopened, day).expect("schedule");
        assert_eq!(schedule.effective_start, "10:00");
        assert_eq!(schedule.effective_end, "20:00");
        assert!(schedule.has_today_override);
    }
}
