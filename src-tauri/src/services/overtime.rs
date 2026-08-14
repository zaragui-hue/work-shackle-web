use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::overtime_repository::{
    CreateOvertimeRecordInput, OvertimeRecord, OvertimeRepository, OvertimeRepositoryError,
};
use crate::db::repositories::work_end_decision_repository::{
    WorkEndDecisionRepository, WorkEndDecisionRepositoryError,
};
use crate::errors::AppError;
use crate::services::settings::SettingsService;
use crate::services::work_status::WorkStatusService;
use crate::time::calendar_day::{format_work_date, local_date_from_ms};
use crate::time::clock_time::{is_local_time_at_or_after_on_work_date, ClockTimeError};
use crate::time::work_day::{self, auto_end_at_ms_for_work_date};

pub const OVERTIME_STATUS_TYPE: &str = "overtime";
pub const END_TYPE_MANUAL: &str = "manual";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActiveOvertimeDto {
    pub id: String,
    pub work_date: String,
    pub start_at_ms: i64,
    pub auto_end_at_ms: i64,
}

pub struct OvertimeService;

impl OvertimeService {
    pub fn get_active(connection: &Connection) -> Result<Option<ActiveOvertimeDto>, AppError> {
        let active = OvertimeRepository::get_active_record(connection).map_err(map_repo_error)?;
        Ok(active.map(record_to_dto))
    }

    pub fn start(connection: &Connection, now_ms: i64) -> Result<ActiveOvertimeDto, AppError> {
        if let Some(active) =
            OvertimeRepository::get_active_record(connection).map_err(map_repo_error)?
        {
            return Ok(record_to_dto(active));
        }

        let calendar_date = local_date_from_ms(now_ms);
        let schedule = SettingsService::get_work_schedule(connection, calendar_date)?;

        if !is_local_time_at_or_after_on_work_date(now_ms, calendar_date, &schedule.effective_end)
            .map_err(map_clock_time_error)?
        {
            return Err(AppError::InvalidTaskInput {
                message: "尚未到下班时间，无法开启加班".to_string(),
            });
        }

        if WorkEndDecisionRepository::get_for_work_date(connection, calendar_date)
            .map_err(map_work_end_decision_error)?
            .is_some()
        {
            return Err(AppError::InvalidTaskInput {
                message: "今天已确认正常下班，无法开启加班".to_string(),
            });
        }

        let work_date = work_day::work_date_from_timestamp_ms(now_ms);
        let work_date_text = format_work_date(work_date);

        if OvertimeRepository::has_manual_ended_overtime_for_work_date(connection, &work_date_text)
            .map_err(map_repo_error)?
        {
            return Err(AppError::InvalidTaskInput {
                message: "该工作日加班已结束，无法再次开启".to_string(),
            });
        }

        let auto_end_at_ms = auto_end_at_ms_for_work_date(work_date);
        let record_id = new_overtime_id(now_ms);

        connection
            .execute("BEGIN IMMEDIATE", [])
            .map_err(|error| AppError::DatabaseError {
                message: error.to_string(),
            })?;

        let saved = (|| -> Result<OvertimeRecord, AppError> {
            if let Some(active) =
                OvertimeRepository::get_active_record(connection).map_err(map_repo_error)?
            {
                return Ok(active);
            }

            if OvertimeRepository::has_manual_ended_overtime_for_work_date(
                connection,
                &work_date_text,
            )
            .map_err(map_repo_error)?
            {
                return Err(AppError::InvalidTaskInput {
                    message: "该工作日加班已结束，无法再次开启".to_string(),
                });
            }

            let record = OvertimeRepository::insert_record(
                connection,
                CreateOvertimeRecordInput {
                    id: record_id.clone(),
                    work_date: work_date_text,
                    start_at_ms: now_ms,
                    auto_end_at_ms,
                },
            )
            .map_err(map_repo_error)?;

            WorkStatusService::open_system_linked_status(connection, OVERTIME_STATUS_TYPE, now_ms)?;
            Ok(record)
        })();

        match saved {
            Ok(record) => {
                connection
                    .execute("COMMIT", [])
                    .map_err(|error| AppError::DatabaseError {
                        message: error.to_string(),
                    })?;
                Ok(record_to_dto(record))
            }
            Err(error) => {
                let _ = connection.execute("ROLLBACK", []);
                Err(error)
            }
        }
    }

    pub fn end_manual(connection: &Connection, now_ms: i64) -> Result<(), AppError> {
        connection
            .execute("BEGIN IMMEDIATE", [])
            .map_err(|error| AppError::DatabaseError {
                message: error.to_string(),
            })?;

        let saved = (|| -> Result<(), AppError> {
            let ended = OvertimeRepository::end_active_record(connection, now_ms, END_TYPE_MANUAL)
                .map_err(map_repo_error)?;
            if ended.is_none() {
                return Ok(());
            }

            WorkStatusService::close_system_linked_status(
                connection,
                OVERTIME_STATUS_TYPE,
                now_ms,
            )?;
            Ok(())
        })();

        match saved {
            Ok(()) => {
                connection
                    .execute("COMMIT", [])
                    .map_err(|error| AppError::DatabaseError {
                        message: error.to_string(),
                    })?;
                Ok(())
            }
            Err(error) => {
                let _ = connection.execute("ROLLBACK", []);
                Err(error)
            }
        }
    }
}

fn record_to_dto(record: OvertimeRecord) -> ActiveOvertimeDto {
    ActiveOvertimeDto {
        id: record.id,
        work_date: record.work_date,
        start_at_ms: record.start_at_ms,
        auto_end_at_ms: record.auto_end_at_ms,
    }
}

fn new_overtime_id(now_ms: i64) -> String {
    format!("overtime-{now_ms}")
}

fn map_clock_time_error(error: ClockTimeError) -> AppError {
    AppError::InvalidTaskInput {
        message: error.to_string(),
    }
}

fn map_repo_error(error: OvertimeRepositoryError) -> AppError {
    match error {
        OvertimeRepositoryError::InvalidInput { message } => AppError::InvalidTaskInput { message },
        OvertimeRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

fn map_work_end_decision_error(error: WorkEndDecisionRepositoryError) -> AppError {
    match error {
        WorkEndDecisionRepositoryError::InvalidInput { message } => {
            AppError::InvalidTaskInput { message }
        }
        WorkEndDecisionRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

pub fn elapsed_ms(start_at_ms: i64, now_ms: i64) -> i64 {
    (now_ms - start_at_ms).max(0)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::settings_repository::SettingsRepository;
    use crate::errors::AppError;
    use crate::services::work_end_decision::{WorkEndDecisionService, WorkEndPhase};
    use crate::services::work_status::{SwitchWorkStatusRequest, WorkStatusService};
    use chrono::{Local, NaiveDate, NaiveDateTime, TimeZone};

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
    fn pending_decision_start_overtime_enters_active_state() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "18:31");

        let before = WorkEndDecisionService::get_state(&db.connection, now_ms).expect("before");
        assert_eq!(before.phase, WorkEndPhase::PendingDecision);

        let active = OvertimeService::start(&db.connection, now_ms).expect("start");
        assert_eq!(active.start_at_ms, now_ms);

        let after = WorkEndDecisionService::get_state(&db.connection, now_ms).expect("after");
        assert_eq!(after.phase, WorkEndPhase::OvertimeActive);
    }

    #[test]
    fn start_creates_active_overtime_record_with_work_date_and_auto_end() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "19:00");

        let active = OvertimeService::start(&db.connection, now_ms).expect("start");
        assert_eq!(active.work_date, "2026-08-14");
        assert_eq!(
            active.auto_end_at_ms,
            auto_end_at_ms_for_work_date(NaiveDate::from_ymd_opt(2026, 8, 14).expect("date"))
        );

        let row = OvertimeRepository::get_active_record(&db.connection)
            .expect("query")
            .expect("active");
        assert!(row.end_at_ms.is_none());
        assert!(row.end_type.is_none());
    }

    #[test]
    fn start_automatically_enters_overtime_work_status() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "19:00");

        WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "working".to_string(),
            },
        )
        .expect("switch");

        OvertimeService::start(&db.connection, now_ms).expect("start");

        let current = WorkStatusService::get_current(&db.connection)
            .expect("current")
            .expect("active");
        assert_eq!(current.status_type, OVERTIME_STATUS_TYPE);
        assert_eq!(current.start_at_ms, now_ms);
    }

    #[test]
    fn duplicate_start_does_not_create_second_active_record() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "19:00");

        let first = OvertimeService::start(&db.connection, now_ms).expect("first");
        let second = OvertimeService::start(&db.connection, local_ms("2026-08-14", "20:00"))
            .expect("second");

        assert_eq!(first.id, second.id);

        let count: i64 = db
            .connection
            .query_row(
                "SELECT COUNT(*) FROM overtime_records WHERE end_at_ms IS NULL",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(count, 1);
    }

    #[test]
    fn active_overtime_survives_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();
        let now_ms = local_ms("2026-08-14", "19:00");
        let record_id;

        {
            let connection = initialize_database(workspace).expect("initialize");
            SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
            let active = OvertimeService::start(&connection, now_ms).expect("start");
            record_id = active.id;
        }

        let reopened = initialize_database(workspace).expect("reopen");
        let active = OvertimeService::get_active(&reopened)
            .expect("get")
            .expect("active");
        assert_eq!(active.id, record_id);
        assert_eq!(active.start_at_ms, now_ms);
    }

    #[test]
    fn elapsed_ms_is_based_on_start_at_ms() {
        let start = local_ms("2026-08-14", "19:00");
        let now = local_ms("2026-08-14", "20:30");
        assert_eq!(elapsed_ms(start, now), 90 * 60 * 1000);
    }

    #[test]
    fn manual_end_writes_end_at_ms_and_end_type() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "19:00");
        let end_ms = local_ms("2026-08-14", "21:00");

        OvertimeService::start(&db.connection, start_ms).expect("start");
        OvertimeService::end_manual(&db.connection, end_ms).expect("end");

        let row = db
            .connection
            .query_row(
                "SELECT end_at_ms, end_type FROM overtime_records LIMIT 1",
                [],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, String>(1)?)),
            )
            .expect("row");
        assert_eq!(row.0, end_ms);
        assert_eq!(row.1, END_TYPE_MANUAL);
    }

    #[test]
    fn manual_end_closes_active_overtime_work_status() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "19:00");
        let end_ms = local_ms("2026-08-14", "21:00");

        OvertimeService::start(&db.connection, start_ms).expect("start");
        OvertimeService::end_manual(&db.connection, end_ms).expect("end");

        assert!(WorkStatusService::get_current(&db.connection)
            .expect("current")
            .is_none());

        let end_at_ms: i64 = db
            .connection
            .query_row(
                "SELECT end_at_ms FROM work_status_records WHERE status_type = 'overtime'",
                [],
                |row| row.get(0),
            )
            .expect("end_at_ms");
        assert_eq!(end_at_ms, end_ms);
    }

    #[test]
    fn repeated_manual_end_is_idempotent() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "19:00");
        let end_ms = local_ms("2026-08-14", "21:00");

        OvertimeService::start(&db.connection, start_ms).expect("start");
        OvertimeService::end_manual(&db.connection, end_ms).expect("first end");
        OvertimeService::end_manual(&db.connection, local_ms("2026-08-14", "22:00"))
            .expect("second end");

        let end_at_ms: i64 = db
            .connection
            .query_row(
                "SELECT end_at_ms FROM overtime_records LIMIT 1",
                [],
                |row| row.get(0),
            )
            .expect("end_at_ms");
        assert_eq!(end_at_ms, end_ms);
    }

    #[test]
    fn midnight_overtime_uses_previous_work_date() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "23:30");

        let active = OvertimeService::start(&db.connection, now_ms).expect("start");
        assert_eq!(active.work_date, "2026-08-14");
        assert_eq!(active.auto_end_at_ms, local_ms("2026-08-15", "05:00"));
    }

    #[test]
    fn does_not_auto_end_at_0500_in_this_task() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "23:00");
        let after_cutoff = local_ms("2026-08-15", "05:01");

        OvertimeService::start(&db.connection, start_ms).expect("start");

        let active = OvertimeRepository::get_active_record(&db.connection)
            .expect("query")
            .expect("still active");
        assert!(active.end_at_ms.is_none());
        assert!(active.end_type.is_none());
        assert!(OvertimeService::get_active(&db.connection)
            .expect("get")
            .is_some());

        let end_at_ms: Option<i64> = db
            .connection
            .query_row(
                "SELECT end_at_ms FROM overtime_records WHERE id = ?1",
                [active.id.as_str()],
                |row| row.get(0),
            )
            .expect("end_at_ms");
        assert!(end_at_ms.is_none());

        let _ = after_cutoff;
    }

    #[test]
    fn manual_end_returns_overtime_finished_not_pending_decision() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "19:00");
        let end_ms = local_ms("2026-08-14", "21:00");

        OvertimeService::start(&db.connection, start_ms).expect("start");
        OvertimeService::end_manual(&db.connection, end_ms).expect("end");

        let state = WorkEndDecisionService::get_state(&db.connection, end_ms).expect("state");
        assert_eq!(state.phase, WorkEndPhase::OvertimeFinished);
        assert_ne!(state.phase, WorkEndPhase::PendingDecision);
        assert_eq!(
            state.display_copy.as_deref(),
            Some(crate::services::work_end_decision::OVERTIME_FINISHED_MESSAGE)
        );
    }

    #[test]
    fn overtime_finished_survives_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();
        let start_ms = local_ms("2026-08-14", "19:00");
        let end_ms = local_ms("2026-08-14", "21:00");

        {
            let connection = initialize_database(workspace).expect("initialize");
            SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
            OvertimeService::start(&connection, start_ms).expect("start");
            OvertimeService::end_manual(&connection, end_ms).expect("end");
        }

        let reopened = initialize_database(workspace).expect("reopen");
        let state = WorkEndDecisionService::get_state(&reopened, end_ms).expect("state");
        assert_eq!(state.phase, WorkEndPhase::OvertimeFinished);
    }

    #[test]
    fn cannot_start_second_overtime_after_manual_end_for_same_work_date() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "19:00");
        let end_ms = local_ms("2026-08-14", "21:00");

        OvertimeService::start(&db.connection, start_ms).expect("start");
        OvertimeService::end_manual(&db.connection, end_ms).expect("end");

        let err = OvertimeService::start(&db.connection, local_ms("2026-08-14", "22:00"))
            .expect_err("blocked");
        assert!(matches!(err, AppError::InvalidTaskInput { .. }));

        let count: i64 = db
            .connection
            .query_row("SELECT COUNT(*) FROM overtime_records", [], |row| {
                row.get(0)
            })
            .expect("count");
        assert_eq!(count, 1);
    }

    #[test]
    fn ended_overtime_does_not_finish_next_work_date() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "19:00");
        let end_ms = local_ms("2026-08-14", "21:00");

        OvertimeService::start(&db.connection, start_ms).expect("start");
        OvertimeService::end_manual(&db.connection, end_ms).expect("end");

        let next_work_date =
            WorkEndDecisionService::get_state(&db.connection, local_ms("2026-08-15", "09:00"))
                .expect("next day");
        assert_ne!(next_work_date.phase, WorkEndPhase::OvertimeFinished);
        assert_eq!(next_work_date.phase, WorkEndPhase::BeforeEnd);
    }

    #[test]
    fn overtime_finished_before_calendar_end_on_next_morning_same_work_date() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let start_ms = local_ms("2026-08-14", "23:00");
        let end_ms = local_ms("2026-08-14", "23:45");

        OvertimeService::start(&db.connection, start_ms).expect("start");
        OvertimeService::end_manual(&db.connection, end_ms).expect("end");

        let early_morning =
            WorkEndDecisionService::get_state(&db.connection, local_ms("2026-08-15", "02:00"))
                .expect("early morning");
        assert_eq!(early_morning.phase, WorkEndPhase::OvertimeFinished);
    }

    #[test]
    fn active_overtime_still_takes_priority_over_finished_record() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        db.connection
            .execute(
                "INSERT INTO overtime_records
                 (id, work_date, start_at_ms, end_at_ms, auto_end_at_ms, end_type)
                 VALUES ('ended-1', '2026-08-13', 1000, 2000, 3000, 'manual')",
                [],
            )
            .expect("insert ended");

        let now_ms = local_ms("2026-08-14", "19:00");
        OvertimeService::start(&db.connection, now_ms).expect("start");

        let state = WorkEndDecisionService::get_state(&db.connection, now_ms).expect("state");
        assert_eq!(state.phase, WorkEndPhase::OvertimeActive);
    }
}
