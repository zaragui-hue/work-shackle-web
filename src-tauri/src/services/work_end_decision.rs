use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::overtime_repository::OvertimeRepository;
use crate::db::repositories::work_end_decision_repository::{
    has_active_overtime, WorkEndDecisionRepository, WorkEndDecisionRepositoryError,
};
use crate::db::repositories::work_status_repository::{
    WorkStatusRepository, WorkStatusRepositoryError,
};
use crate::errors::AppError;
use crate::services::settings::SettingsService;
use crate::time::calendar_day::{format_work_date, local_date_from_ms};
use crate::time::clock_time::{is_local_time_at_or_after_on_work_date, ClockTimeError};
use crate::time::work_day;

pub const OFF_WORK_MESSAGES: &[&str] = &[
    "今天就到这儿，剩下的交给明天的自己。",
    "已下班。工作消息从现在开始酌情理解。",
    "电脑合上，恩怨清零。",
];

pub const OVERTIME_FINISHED_MESSAGE: &str = "加班结束，今天真的收工啦。";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WorkEndPhase {
    BeforeEnd,
    PendingDecision,
    NormalOff,
    OvertimeActive,
    OvertimeFinished,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkEndStateDto {
    pub work_date: String,
    pub effective_end: String,
    pub phase: WorkEndPhase,
    pub display_copy: Option<String>,
}

pub struct WorkEndDecisionService;

impl WorkEndDecisionService {
    pub fn get_state(connection: &Connection, now_ms: i64) -> Result<WorkEndStateDto, AppError> {
        let calendar_date = local_date_from_ms(now_ms);
        let schedule = SettingsService::get_work_schedule(connection, calendar_date)?;
        let current_work_date = format_work_date(work_day::work_date_from_timestamp_ms(now_ms));

        if has_active_overtime(connection).map_err(map_db_error)? {
            return Ok(WorkEndStateDto {
                work_date: schedule.work_date,
                effective_end: schedule.effective_end,
                phase: WorkEndPhase::OvertimeActive,
                display_copy: None,
            });
        }

        if OvertimeRepository::has_manual_ended_overtime_for_work_date(
            connection,
            current_work_date.as_str(),
        )
        .map_err(map_overtime_repo_error)?
        {
            return Ok(WorkEndStateDto {
                work_date: schedule.work_date,
                effective_end: schedule.effective_end,
                phase: WorkEndPhase::OvertimeFinished,
                display_copy: Some(OVERTIME_FINISHED_MESSAGE.to_string()),
            });
        }

        if let Some(decision) =
            WorkEndDecisionRepository::get_for_work_date(connection, calendar_date)
                .map_err(map_repo_error)?
        {
            return Ok(WorkEndStateDto {
                work_date: schedule.work_date,
                effective_end: schedule.effective_end,
                phase: WorkEndPhase::NormalOff,
                display_copy: Some(decision.display_copy),
            });
        }

        if !is_local_time_at_or_after_on_work_date(now_ms, calendar_date, &schedule.effective_end)
            .map_err(map_clock_time_error)?
        {
            return Ok(WorkEndStateDto {
                work_date: schedule.work_date,
                effective_end: schedule.effective_end,
                phase: WorkEndPhase::BeforeEnd,
                display_copy: None,
            });
        }

        Ok(WorkEndStateDto {
            work_date: schedule.work_date,
            effective_end: schedule.effective_end,
            phase: WorkEndPhase::PendingDecision,
            display_copy: None,
        })
    }

    pub fn confirm_normal_off(
        connection: &Connection,
        now_ms: i64,
    ) -> Result<WorkEndStateDto, AppError> {
        let work_date = local_date_from_ms(now_ms);
        let schedule = SettingsService::get_work_schedule(connection, work_date)?;

        if !is_local_time_at_or_after_on_work_date(now_ms, work_date, &schedule.effective_end)
            .map_err(map_clock_time_error)?
        {
            return Err(AppError::InvalidTaskInput {
                message: "尚未到下班时间，无法确认正常下班".to_string(),
            });
        }

        if has_active_overtime(connection).map_err(map_db_error)? {
            return Err(AppError::InvalidTaskInput {
                message: "当前已在加班中".to_string(),
            });
        }

        if WorkEndDecisionRepository::get_for_work_date(connection, work_date)
            .map_err(map_repo_error)?
            .is_some()
        {
            return Self::finalize_normal_off(connection, now_ms, None);
        }

        let display_copy = pick_off_work_message(now_ms).to_string();
        Self::finalize_normal_off(connection, now_ms, Some(display_copy))
    }

    fn finalize_normal_off(
        connection: &Connection,
        now_ms: i64,
        display_copy: Option<String>,
    ) -> Result<WorkEndStateDto, AppError> {
        connection
            .execute("BEGIN IMMEDIATE", [])
            .map_err(|error| AppError::DatabaseError {
                message: error.to_string(),
            })?;

        let saved = (|| -> Result<(), AppError> {
            WorkStatusRepository::close_active_records(connection, now_ms)
                .map_err(map_work_status_error)?;
            if let Some(display_copy) = display_copy {
                let work_date = local_date_from_ms(now_ms);
                WorkEndDecisionRepository::insert_normal_off(
                    connection,
                    work_date,
                    &display_copy,
                    now_ms,
                )
                .map_err(map_repo_error)?;
            }
            Ok(())
        })();

        match saved {
            Ok(()) => {
                connection
                    .execute("COMMIT", [])
                    .map_err(|error| AppError::DatabaseError {
                        message: error.to_string(),
                    })?;
                Self::get_state(connection, now_ms)
            }
            Err(error) => {
                let _ = connection.execute("ROLLBACK", []);
                Err(error)
            }
        }
    }
}

fn pick_off_work_message(now_ms: i64) -> &'static str {
    let index = (now_ms.unsigned_abs() as usize) % OFF_WORK_MESSAGES.len();
    OFF_WORK_MESSAGES[index]
}

fn map_clock_time_error(error: ClockTimeError) -> AppError {
    AppError::InvalidTaskInput {
        message: error.to_string(),
    }
}

fn map_repo_error(error: WorkEndDecisionRepositoryError) -> AppError {
    match error {
        WorkEndDecisionRepositoryError::InvalidInput { message } => {
            AppError::InvalidTaskInput { message }
        }
        WorkEndDecisionRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

fn map_work_status_error(error: WorkStatusRepositoryError) -> AppError {
    match error {
        WorkStatusRepositoryError::InvalidInput { message } => {
            AppError::InvalidTaskInput { message }
        }
        WorkStatusRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

fn map_db_error(error: crate::db::connection::DbError) -> AppError {
    AppError::DatabaseError {
        message: error.to_string(),
    }
}

fn map_overtime_repo_error(
    error: crate::db::repositories::overtime_repository::OvertimeRepositoryError,
) -> AppError {
    match error {
        crate::db::repositories::overtime_repository::OvertimeRepositoryError::InvalidInput {
            message,
        } => AppError::InvalidTaskInput { message },
        crate::db::repositories::overtime_repository::OvertimeRepositoryError::Db(db_error) => {
            AppError::DatabaseError {
                message: db_error.to_string(),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::settings_repository::SettingsRepository;
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
    fn before_end_returns_before_end_phase() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        let state =
            WorkEndDecisionService::get_state(&db.connection, local_ms("2026-08-14", "17:59"))
                .expect("state");
        assert_eq!(state.phase, WorkEndPhase::BeforeEnd);
        assert!(state.display_copy.is_none());
    }

    #[test]
    fn at_end_returns_pending_decision_without_auto_overtime() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        let state =
            WorkEndDecisionService::get_state(&db.connection, local_ms("2026-08-14", "18:30"))
                .expect("state");
        assert_eq!(state.phase, WorkEndPhase::PendingDecision);
        assert!(state.display_copy.is_none());

        let active_count: i64 = db
            .connection
            .query_row(
                "SELECT COUNT(*) FROM overtime_records WHERE end_at_ms IS NULL",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(active_count, 0);
    }

    #[test]
    fn confirm_normal_off_persists_decision_and_message() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "18:31");

        let state =
            WorkEndDecisionService::confirm_normal_off(&db.connection, now_ms).expect("confirm");
        assert_eq!(state.phase, WorkEndPhase::NormalOff);
        let message = state.display_copy.expect("message");
        assert!(OFF_WORK_MESSAGES.contains(&message.as_str()));

        let reopened =
            WorkEndDecisionService::get_state(&db.connection, local_ms("2026-08-14", "20:00"))
                .expect("reloaded");
        assert_eq!(reopened.phase, WorkEndPhase::NormalOff);
        assert_eq!(reopened.display_copy, Some(message));
    }

    #[test]
    fn confirm_normal_off_does_not_create_overtime_record() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        WorkEndDecisionService::confirm_normal_off(&db.connection, local_ms("2026-08-14", "19:00"))
            .expect("confirm");

        let count: i64 = db
            .connection
            .query_row("SELECT COUNT(*) FROM overtime_records", [], |row| {
                row.get(0)
            })
            .expect("count");
        assert_eq!(count, 0);
    }

    #[test]
    fn cannot_confirm_normal_off_before_end_time() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");

        let err = WorkEndDecisionService::confirm_normal_off(
            &db.connection,
            local_ms("2026-08-14", "09:00"),
        )
        .expect_err("too early");
        assert!(matches!(err, AppError::InvalidTaskInput { .. }));
    }

    #[test]
    fn active_overtime_skips_pending_decision() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        db.connection
            .execute(
                "INSERT INTO overtime_records
                 (id, work_date, start_at_ms, end_at_ms, auto_end_at_ms, end_type)
                 VALUES ('ot-1', '2026-08-14', 1000, NULL, 2000, NULL)",
                [],
            )
            .expect("insert overtime");

        let state =
            WorkEndDecisionService::get_state(&db.connection, local_ms("2026-08-14", "19:00"))
                .expect("state");
        assert_eq!(state.phase, WorkEndPhase::OvertimeActive);
    }

    #[test]
    fn uses_effective_end_from_today_override() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let work_date = NaiveDate::from_ymd_opt(2026, 8, 14).expect("date");
        SettingsRepository::upsert_override(&db.connection, work_date, "10:00", "20:00")
            .expect("override");

        let before =
            WorkEndDecisionService::get_state(&db.connection, local_ms("2026-08-14", "19:59"))
                .expect("before override end");
        assert_eq!(before.phase, WorkEndPhase::BeforeEnd);

        let after =
            WorkEndDecisionService::get_state(&db.connection, local_ms("2026-08-14", "20:00"))
                .expect("after override end");
        assert_eq!(after.phase, WorkEndPhase::PendingDecision);
        assert_eq!(after.effective_end, "20:00");
    }

    #[test]
    fn normal_off_survives_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();
        let now_ms = local_ms("2026-08-14", "18:30");

        {
            let connection = initialize_database(workspace).expect("initialize");
            SettingsRepository::ensure_defaults(&connection, 1).expect("seed");
            WorkStatusService::switch(
                &connection,
                SwitchWorkStatusRequest {
                    status_type: "working".to_string(),
                },
            )
            .expect("switch");
            WorkEndDecisionService::confirm_normal_off(&connection, now_ms).expect("confirm");
        }

        let reopened = initialize_database(workspace).expect("reopen");
        let state = WorkEndDecisionService::get_state(&reopened, local_ms("2026-08-14", "21:00"))
            .expect("state");
        assert_eq!(state.phase, WorkEndPhase::NormalOff);
        assert!(state.display_copy.is_some());
        assert!(WorkStatusService::get_current(&reopened)
            .expect("current")
            .is_none());
    }

    #[test]
    fn confirm_normal_off_closes_active_working_status() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "18:31");

        WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "working".to_string(),
            },
        )
        .expect("switch");

        WorkEndDecisionService::confirm_normal_off(&db.connection, now_ms).expect("confirm");

        let active_count: i64 = db
            .connection
            .query_row(
                "SELECT COUNT(*) FROM work_status_records WHERE end_at_ms IS NULL",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(active_count, 0);

        let end_at_ms: i64 = db
            .connection
            .query_row(
                "SELECT end_at_ms FROM work_status_records WHERE status_type = 'working'",
                [],
                |row| row.get(0),
            )
            .expect("end_at_ms");
        assert_eq!(end_at_ms, now_ms);
    }

    #[test]
    fn confirm_normal_off_clears_get_current_work_status() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "18:31");

        WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "working".to_string(),
            },
        )
        .expect("switch");
        assert!(WorkStatusService::get_current(&db.connection)
            .expect("before")
            .is_some());

        WorkEndDecisionService::confirm_normal_off(&db.connection, now_ms).expect("confirm");

        assert!(WorkStatusService::get_current(&db.connection)
            .expect("after")
            .is_none());
    }

    #[test]
    fn confirm_normal_off_succeeds_without_active_work_status() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "18:31");

        assert!(WorkStatusService::get_current(&db.connection)
            .expect("before")
            .is_none());

        let state =
            WorkEndDecisionService::confirm_normal_off(&db.connection, now_ms).expect("confirm");
        assert_eq!(state.phase, WorkEndPhase::NormalOff);
    }

    #[test]
    fn repeated_confirm_normal_off_is_idempotent_without_active_status() {
        let db = open_test_database();
        SettingsRepository::ensure_defaults(&db.connection, 1).expect("seed");
        let now_ms = local_ms("2026-08-14", "18:31");

        WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "working".to_string(),
            },
        )
        .expect("switch");

        let first =
            WorkEndDecisionService::confirm_normal_off(&db.connection, now_ms).expect("first");
        let second = WorkEndDecisionService::confirm_normal_off(
            &db.connection,
            local_ms("2026-08-14", "19:00"),
        )
        .expect("second");

        assert_eq!(first.display_copy, second.display_copy);
        assert_eq!(second.phase, WorkEndPhase::NormalOff);

        let decision_count: i64 = db
            .connection
            .query_row("SELECT COUNT(*) FROM work_end_decisions", [], |row| {
                row.get(0)
            })
            .expect("decision count");
        assert_eq!(decision_count, 1);

        let overtime_count: i64 = db
            .connection
            .query_row("SELECT COUNT(*) FROM overtime_records", [], |row| {
                row.get(0)
            })
            .expect("overtime count");
        assert_eq!(overtime_count, 0);

        assert!(WorkStatusService::get_current(&db.connection)
            .expect("current")
            .is_none());
    }
}
