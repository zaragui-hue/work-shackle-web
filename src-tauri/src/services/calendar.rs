use std::collections::{HashMap, HashSet};

use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::task_repository::{TaskQuery, TaskRepository};
use crate::errors::AppError;
use crate::services::task::{map_task_entity_to_dto, TaskDto};
use crate::time::calendar_day::{
    format_work_date, is_local_calendar_day_before, is_same_local_calendar_day, local_date_from_ms,
    local_dates_inclusive, parse_local_date,
};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarDayTaskCountDto {
    pub date: String,
    pub task_count: i32,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarTaskCountQueryRequest {
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarDayTasksQueryRequest {
    pub date: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarDayTasksDto {
    pub date: String,
    pub formal_tasks: Vec<TaskDto>,
    pub overdue_tasks: Vec<TaskDto>,
    pub completed_tasks: Vec<TaskDto>,
    pub cancelled_tasks: Vec<TaskDto>,
}

pub struct CalendarService;

impl CalendarService {
    pub fn query_task_counts(
        connection: &Connection,
        query: CalendarTaskCountQueryRequest,
    ) -> Result<Vec<CalendarDayTaskCountDto>, AppError> {
        let start_date =
            parse_local_date(&query.start_date).map_err(|message| AppError::InvalidTaskInput {
                message: format!("invalid calendar start date: {message}"),
            })?;
        let end_date =
            parse_local_date(&query.end_date).map_err(|message| AppError::InvalidTaskInput {
                message: format!("invalid calendar end date: {message}"),
            })?;

        if start_date > end_date {
            return Err(AppError::InvalidTaskInput {
                message: "calendar start date must not be after end date".to_string(),
            });
        }

        let candidates =
            TaskRepository::list_calendar_count_candidates(connection).map_err(map_task_error)?;

        let mut counts_by_date: HashMap<String, HashSet<String>> = HashMap::new();
        for candidate in candidates {
            accumulate_task_date(
                &mut counts_by_date,
                &candidate.id,
                local_date_from_ms(candidate.planned_at_ms),
                start_date,
                end_date,
            );

            if let Some(deadline_at_ms) = candidate.deadline_at_ms {
                accumulate_task_date(
                    &mut counts_by_date,
                    &candidate.id,
                    local_date_from_ms(deadline_at_ms),
                    start_date,
                    end_date,
                );
            }
        }

        Ok(local_dates_inclusive(start_date, end_date)
            .into_iter()
            .map(|date| {
                let date_key = format_work_date(date);
                let task_count = counts_by_date
                    .get(&date_key)
                    .map(|task_ids| task_ids.len() as i32)
                    .unwrap_or(0);
                CalendarDayTaskCountDto {
                    date: date_key,
                    task_count,
                }
            })
            .collect())
    }

    pub fn query_day_tasks(
        connection: &Connection,
        query: CalendarDayTasksQueryRequest,
        as_of_ms: i64,
    ) -> Result<CalendarDayTasksDto, AppError> {
        let target_date =
            parse_local_date(&query.date).map_err(|message| AppError::InvalidTaskInput {
                message: format!("invalid calendar day date: {message}"),
            })?;
        let today = local_date_from_ms(as_of_ms);

        let tasks =
            TaskRepository::query(connection, TaskQuery::default()).map_err(map_task_error)?;

        let mut formal_tasks = Vec::new();
        let mut overdue_tasks = Vec::new();
        let mut completed_tasks = Vec::new();
        let mut cancelled_tasks = Vec::new();

        for task in tasks {
            let dto = map_task_entity_to_dto(task);
            if !task_belongs_to_calendar_date(&dto, target_date) {
                continue;
            }

            if matches!(dto.status, crate::services::task::TaskStatusDto::Completed) {
                completed_tasks.push(dto);
                continue;
            }

            if matches!(dto.status, crate::services::task::TaskStatusDto::Cancelled) {
                cancelled_tasks.push(dto);
                continue;
            }

            let is_historical_overdue = dto
                .deadline_at_ms
                .is_some_and(|deadline_at_ms| is_local_calendar_day_before(deadline_at_ms, today));

            if is_historical_overdue {
                overdue_tasks.push(dto);
            } else {
                formal_tasks.push(dto);
            }
        }

        formal_tasks.sort_by_key(|task| (task.planned_at_ms, task.id.clone()));
        overdue_tasks
            .sort_by_key(|task| (task.deadline_at_ms.unwrap_or(i64::MAX), task.id.clone()));
        completed_tasks.sort_by_key(|task| {
            (
                std::cmp::Reverse(task.completed_at_ms.unwrap_or(0)),
                task.id.clone(),
            )
        });
        cancelled_tasks.sort_by_key(|task| (task.updated_at_ms, task.id.clone()));

        Ok(CalendarDayTasksDto {
            date: format_work_date(target_date),
            formal_tasks,
            overdue_tasks,
            completed_tasks,
            cancelled_tasks,
        })
    }
}

fn task_belongs_to_calendar_date(dto: &TaskDto, target_date: chrono::NaiveDate) -> bool {
    is_same_local_calendar_day(dto.planned_at_ms, target_date)
        || dto
            .deadline_at_ms
            .is_some_and(|deadline_at_ms| is_same_local_calendar_day(deadline_at_ms, target_date))
}

fn accumulate_task_date(
    counts_by_date: &mut HashMap<String, HashSet<String>>,
    task_id: &str,
    task_date: chrono::NaiveDate,
    start_date: chrono::NaiveDate,
    end_date: chrono::NaiveDate,
) {
    if task_date < start_date || task_date > end_date {
        return;
    }

    counts_by_date
        .entry(format_work_date(task_date))
        .or_default()
        .insert(task_id.to_string());
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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Local, NaiveDateTime, TimeZone};

    use crate::db::connection::initialize_database;
    use crate::db::repositories::task_repository::{CreateTaskInput, TaskRepository};

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
            .expect("valid datetime");
        Local
            .from_local_datetime(&naive)
            .single()
            .expect("valid local datetime")
            .timestamp_millis()
    }

    fn insert_task(
        connection: &Connection,
        id: &str,
        planned_at_ms: i64,
        deadline_at_ms: Option<i64>,
    ) {
        TaskRepository::create(
            connection,
            CreateTaskInput {
                id: id.to_string(),
                title: id.to_string(),
                note: None,
                planned_at_ms,
                deadline_at_ms,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                created_at_ms: planned_at_ms,
                updated_at_ms: planned_at_ms,
            },
        )
        .expect("insert task");
    }

    fn query_range(
        connection: &Connection,
        start_date: &str,
        end_date: &str,
    ) -> Vec<CalendarDayTaskCountDto> {
        CalendarService::query_task_counts(
            connection,
            CalendarTaskCountQueryRequest {
                start_date: start_date.to_string(),
                end_date: end_date.to_string(),
            },
        )
        .expect("calendar counts")
    }

    fn count_on(results: &[CalendarDayTaskCountDto], date: &str) -> i32 {
        results
            .iter()
            .find(|entry| entry.date == date)
            .map(|entry| entry.task_count)
            .unwrap_or(0)
    }

    const AUG_18: &str = "2026-08-18";
    const AUG_19: &str = "2026-08-19";
    const AUG_20: &str = "2026-08-20";
    const AUG_15: &str = "2026-08-15";

    #[test]
    fn planned_date_counts_once_for_that_day() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "planned-only",
            local_ms(AUG_18, "09:00"),
            None,
        );

        let results = query_range(&db.connection, AUG_18, AUG_18);
        assert_eq!(count_on(&results, AUG_18), 1);
    }

    #[test]
    fn deadline_date_counts_once_for_that_day() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "deadline-only",
            local_ms(AUG_19, "09:00"),
            Some(local_ms(AUG_18, "18:00")),
        );

        let results = query_range(&db.connection, AUG_18, AUG_18);
        assert_eq!(count_on(&results, AUG_18), 1);
    }

    #[test]
    fn planned_and_deadline_same_day_count_once() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "same-day",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_18, "18:00")),
        );

        let results = query_range(&db.connection, AUG_18, AUG_18);
        assert_eq!(count_on(&results, AUG_18), 1);
    }

    #[test]
    fn planned_and_deadline_on_different_days_count_on_each_day() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "cross-day",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_20, "18:00")),
        );

        let results = query_range(&db.connection, AUG_18, AUG_20);
        assert_eq!(count_on(&results, AUG_18), 1);
        assert_eq!(count_on(&results, AUG_19), 0);
        assert_eq!(count_on(&results, AUG_20), 1);
    }

    #[test]
    fn two_tasks_on_same_day_sum_to_two() {
        let db = open_test_database();
        insert_task(&db.connection, "task-a", local_ms(AUG_18, "09:00"), None);
        insert_task(&db.connection, "task-b", local_ms(AUG_18, "11:00"), None);

        let results = query_range(&db.connection, AUG_18, AUG_18);
        assert_eq!(count_on(&results, AUG_18), 2);
    }

    #[test]
    fn task_without_deadline_only_uses_planned_date() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "no-deadline",
            local_ms(AUG_18, "09:00"),
            None,
        );

        let results = query_range(&db.connection, AUG_18, AUG_19);
        assert_eq!(count_on(&results, AUG_18), 1);
        assert_eq!(count_on(&results, AUG_19), 0);
    }

    #[test]
    fn historical_overdue_only_counts_on_real_planned_or_deadline_dates() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "historical-overdue",
            local_ms(AUG_15, "09:00"),
            Some(local_ms(AUG_15, "18:00")),
        );

        let results = query_range(&db.connection, AUG_15, AUG_20);
        assert_eq!(count_on(&results, AUG_15), 1);
        assert_eq!(count_on(&results, AUG_18), 0);
        assert_eq!(count_on(&results, AUG_19), 0);
        assert_eq!(count_on(&results, AUG_20), 0);
    }

    #[test]
    fn today_deadline_passed_still_counts_for_today() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "today-ddl-passed",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_18, "15:00")),
        );

        let results = query_range(&db.connection, AUG_18, AUG_18);
        assert_eq!(count_on(&results, AUG_18), 1);
    }

    #[test]
    fn query_range_only_returns_requested_dates() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "range-boundary",
            local_ms("2026-07-31", "09:00"),
            Some(local_ms("2026-09-01", "18:00")),
        );

        let results = query_range(&db.connection, "2026-08-01", "2026-08-31");
        assert_eq!(results.len(), 31);
        assert_eq!(count_on(&results, "2026-07-31"), 0);
        assert_eq!(count_on(&results, "2026-08-01"), 0);
        assert_eq!(count_on(&results, "2026-09-01"), 0);
    }

    #[test]
    fn cross_year_range_returns_contiguous_dates() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "year-boundary",
            local_ms("2025-12-31", "09:00"),
            Some(local_ms("2026-01-01", "18:00")),
        );

        let results = query_range(&db.connection, "2025-12-30", "2026-01-02");
        assert_eq!(results.len(), 4);
        assert_eq!(count_on(&results, "2025-12-30"), 0);
        assert_eq!(count_on(&results, "2025-12-31"), 1);
        assert_eq!(count_on(&results, "2026-01-01"), 1);
        assert_eq!(count_on(&results, "2026-01-02"), 0);
    }

    #[test]
    fn local_calendar_day_uses_local_date_not_utc_or_workday_cutoff() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "local-day",
            local_ms(AUG_18, "23:30"),
            Some(local_ms(AUG_19, "00:30")),
        );

        let results = query_range(&db.connection, AUG_18, AUG_19);
        assert_eq!(count_on(&results, AUG_18), 1);
        assert_eq!(count_on(&results, AUG_19), 1);
    }

    #[test]
    fn completed_and_cancelled_tasks_are_excluded() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "completed-task",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_18, "18:00")),
        );
        insert_task(
            &db.connection,
            "cancelled-task",
            local_ms(AUG_18, "10:00"),
            Some(local_ms(AUG_18, "19:00")),
        );
        insert_task(
            &db.connection,
            "active-task",
            local_ms(AUG_18, "11:00"),
            None,
        );
        TaskRepository::complete(&db.connection, "completed-task", local_ms(AUG_18, "12:00"))
            .expect("complete");
        TaskRepository::cancel(&db.connection, "cancelled-task", local_ms(AUG_18, "13:00"))
            .expect("cancel");

        let results = query_range(&db.connection, AUG_18, AUG_18);
        assert_eq!(count_on(&results, AUG_18), 1);
    }

    #[test]
    fn calendar_counts_survive_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let first = initialize_database(temp.path()).expect("initialize database");
        insert_task(
            &first,
            "persist-count",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_20, "18:00")),
        );
        let before = query_range(&first, AUG_18, AUG_20);
        drop(first);

        let reopened = initialize_database(temp.path()).expect("reopen database");
        let after = query_range(&reopened, AUG_18, AUG_20);
        assert_eq!(before, after);
    }

    #[test]
    fn invalid_date_range_is_rejected() {
        let db = open_test_database();
        let error = CalendarService::query_task_counts(
            &db.connection,
            CalendarTaskCountQueryRequest {
                start_date: AUG_20.to_string(),
                end_date: AUG_18.to_string(),
            },
        )
        .expect_err("invalid range");

        assert!(matches!(error, AppError::InvalidTaskInput { .. }));
    }

    fn query_day(connection: &Connection, date: &str, as_of_ms: i64) -> CalendarDayTasksDto {
        CalendarService::query_day_tasks(
            connection,
            CalendarDayTasksQueryRequest {
                date: date.to_string(),
            },
            as_of_ms,
        )
        .expect("calendar day tasks")
    }

    fn ids_from_day(tasks: &CalendarDayTasksDto) -> Vec<&str> {
        tasks
            .formal_tasks
            .iter()
            .chain(tasks.overdue_tasks.iter())
            .chain(tasks.completed_tasks.iter())
            .chain(tasks.cancelled_tasks.iter())
            .map(|task| task.id.as_str())
            .collect()
    }

    #[test]
    fn day_drawer_includes_planned_date_task() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "planned-only",
            local_ms(AUG_18, "09:00"),
            None,
        );

        let result = query_day(&db.connection, AUG_18, local_ms(AUG_18, "16:00"));
        assert_eq!(
            result
                .formal_tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["planned-only"]
        );
    }

    #[test]
    fn day_drawer_includes_deadline_date_task() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "deadline-only",
            local_ms(AUG_19, "09:00"),
            Some(local_ms(AUG_18, "18:00")),
        );

        let result = query_day(&db.connection, AUG_18, local_ms(AUG_18, "16:00"));
        assert_eq!(
            result
                .formal_tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["deadline-only"]
        );
    }

    #[test]
    fn day_drawer_deduplicates_planned_and_deadline_same_day() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "same-day",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_18, "18:00")),
        );

        let result = query_day(&db.connection, AUG_18, local_ms(AUG_18, "16:00"));
        assert_eq!(ids_from_day(&result), vec!["same-day"]);
    }

    #[test]
    fn day_drawer_cross_day_task_only_on_planned_and_deadline_days() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "cross-day",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_20, "18:00")),
        );

        let as_of = local_ms(AUG_20, "10:00");
        assert_eq!(
            ids_from_day(&query_day(&db.connection, AUG_18, as_of)),
            vec!["cross-day"]
        );
        assert!(ids_from_day(&query_day(&db.connection, AUG_19, as_of)).is_empty());
        assert_eq!(
            ids_from_day(&query_day(&db.connection, AUG_20, as_of)),
            vec!["cross-day"]
        );
    }

    #[test]
    fn day_drawer_historical_overdue_does_not_pollute_today() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "historical-overdue",
            local_ms(AUG_15, "09:00"),
            Some(local_ms(AUG_15, "18:00")),
        );

        let as_of = local_ms(AUG_18, "16:00");
        assert_eq!(
            ids_from_day(&query_day(&db.connection, AUG_15, as_of)),
            vec!["historical-overdue"]
        );
        assert!(ids_from_day(&query_day(&db.connection, AUG_18, as_of)).is_empty());
    }

    #[test]
    fn day_drawer_today_deadline_passed_still_shows_task() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "today-ddl-passed",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_18, "15:00")),
        );

        let result = query_day(&db.connection, AUG_18, local_ms(AUG_18, "16:00"));
        assert_eq!(
            result
                .formal_tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["today-ddl-passed"]
        );
        assert!(result.overdue_tasks.is_empty());
    }

    #[test]
    fn day_drawer_places_historical_overdue_in_overdue_section() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "overdue-on-day",
            local_ms(AUG_15, "09:00"),
            Some(local_ms(AUG_15, "18:00")),
        );

        let result = query_day(&db.connection, AUG_15, local_ms(AUG_18, "16:00"));
        assert!(result.formal_tasks.is_empty());
        assert_eq!(
            result
                .overdue_tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["overdue-on-day"]
        );
    }

    #[test]
    fn day_drawer_includes_completed_and_cancelled_on_their_calendar_day() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "completed-task",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_18, "18:00")),
        );
        insert_task(
            &db.connection,
            "cancelled-task",
            local_ms(AUG_18, "10:00"),
            Some(local_ms(AUG_18, "19:00")),
        );
        TaskRepository::complete(&db.connection, "completed-task", local_ms(AUG_18, "12:00"))
            .expect("complete");
        TaskRepository::cancel(&db.connection, "cancelled-task", local_ms(AUG_18, "13:00"))
            .expect("cancel");

        let result = query_day(&db.connection, AUG_18, local_ms(AUG_18, "16:00"));
        assert_eq!(
            result
                .completed_tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["completed-task"]
        );
        assert_eq!(
            result
                .cancelled_tasks
                .iter()
                .map(|task| task.id.as_str())
                .collect::<Vec<_>>(),
            vec!["cancelled-task"]
        );
    }

    #[test]
    fn day_drawer_active_count_matches_calendar_busy_count() {
        let db = open_test_database();
        insert_task(
            &db.connection,
            "completed-task",
            local_ms(AUG_18, "09:00"),
            Some(local_ms(AUG_18, "18:00")),
        );
        insert_task(
            &db.connection,
            "active-task",
            local_ms(AUG_18, "11:00"),
            None,
        );
        TaskRepository::complete(&db.connection, "completed-task", local_ms(AUG_18, "12:00"))
            .expect("complete");

        let as_of = local_ms(AUG_18, "16:00");
        let counts = query_range(&db.connection, AUG_18, AUG_18);
        let day = query_day(&db.connection, AUG_18, as_of);
        let active_count = day.formal_tasks.len() + day.overdue_tasks.len();
        assert_eq!(count_on(&counts, AUG_18), active_count as i32);
    }
}
