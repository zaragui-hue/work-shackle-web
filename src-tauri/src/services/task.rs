use crate::id::new_entity_id;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::contact_repository::ContactRepository;
use crate::db::repositories::postponement_repository::{
    CreatePostponementInput, Postponement, PostponementRepository, PostponementRepositoryError,
};
use crate::db::repositories::reminder_repository::{
    CreateReminderInput, ReminderRepository, ReminderRepositoryError, TaskReminder,
    MAX_USER_REMINDERS,
};
use crate::db::repositories::task_repository::{
    CreateTaskInput, HistoryTaskQuery, Task, TaskQuery, TaskRepository, TaskRepositoryError,
    TaskStatus, UpdateTaskInput,
};
use crate::errors::AppError;
use crate::services::contact::ContactService;
use crate::time::calendar_day;
use crate::time::history_range::{self, HistoryRangeInput, HistoryTimeMode};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDto {
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
    pub planned_at_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deadline_at_ms: Option<i64>,
    pub priority: i32,
    pub status: TaskStatusDto,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub contact_snapshot: Option<String>,
    pub created_at_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_at_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cancelled_at_ms: Option<i64>,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TaskStatusDto {
    NotStarted,
    InProgress,
    Paused,
    Waiting,
    Completed,
    Cancelled,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderDto {
    pub id: String,
    pub task_id: String,
    pub remind_at_ms: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    pub enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fired_at_ms: Option<i64>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostponementDto {
    pub id: String,
    pub task_id: String,
    pub old_deadline_at_ms: i64,
    pub new_deadline_at_ms: i64,
    pub reason: String,
    pub created_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskDetailDto {
    pub task: TaskDto,
    pub reminders: Vec<ReminderDto>,
    pub postponements: Vec<PostponementDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostponeTaskRequest {
    pub task_id: String,
    pub new_deadline_at_ms: i64,
    pub reason: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskReminderRequest {
    pub remind_at_ms: i64,
    #[serde(default)]
    pub message: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskRequest {
    pub title: String,
    #[serde(default)]
    pub note: Option<String>,
    pub planned_at_ms: i64,
    #[serde(default)]
    pub deadline_at_ms: Option<i64>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub contact_id: Option<String>,
    #[serde(default)]
    pub contact_snapshot: Option<String>,
    #[serde(default)]
    pub reminders: Vec<CreateTaskReminderRequest>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskRequest {
    pub id: String,
    #[serde(default)]
    pub title: Option<String>,
    #[serde(default)]
    pub note: Option<Option<String>>,
    #[serde(default)]
    pub planned_at_ms: Option<i64>,
    #[serde(default)]
    pub deadline_at_ms: Option<Option<i64>>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub status: Option<TaskStatusDto>,
    #[serde(default)]
    pub contact_id: Option<Option<String>>,
    #[serde(default)]
    pub contact_snapshot: Option<Option<String>>,
}

#[derive(Debug, Clone, Default, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskQueryRequest {
    #[serde(default)]
    pub status: Option<TaskStatusDto>,
    #[serde(default)]
    pub priority: Option<i32>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HistoryTimeModeDto {
    Day,
    Week,
    Month,
    Quarter,
    Year,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HistoryTasksQueryRequest {
    pub mode: HistoryTimeModeDto,
    #[serde(default)]
    pub anchor_date: Option<String>,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub end_date: Option<String>,
    #[serde(default)]
    pub status: Option<TaskStatusDto>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub contact_id: Option<String>,
    #[serde(default)]
    pub keyword: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodayTasksDto {
    pub formal_tasks: Vec<TaskDto>,
    pub upcoming_deadline_tasks: Vec<TaskDto>,
    pub overdue_tasks: Vec<TaskDto>,
    pub completed_today_tasks: Vec<TaskDto>,
    pub auto_started_task_ids: Vec<String>,
}

pub struct TaskService;

impl TaskService {
    pub fn create(connection: &Connection, input: CreateTaskRequest) -> Result<TaskDto, AppError> {
        validate_create_request(&input)?;

        let now_ms = now_ms();
        let task_id = new_entity_id("task");
        let reminder_inputs = build_reminder_inputs(&task_id, &input.reminders)?;

        let tx = connection
            .unchecked_transaction()
            .map_err(|error| AppError::DatabaseError {
                message: error.to_string(),
            })?;

        let resolved_contact =
            ContactService::resolve_for_task_create(&tx, input.contact_id, input.contact_snapshot)?;

        let task = TaskRepository::create(
            &tx,
            CreateTaskInput {
                id: task_id.clone(),
                title: input.title,
                note: normalize_optional_text(input.note),
                planned_at_ms: input.planned_at_ms,
                deadline_at_ms: input.deadline_at_ms,
                priority: input.priority,
                contact_id: resolved_contact.contact_id,
                contact_snapshot: resolved_contact.contact_snapshot,
                created_at_ms: now_ms,
                updated_at_ms: now_ms,
            },
        )
        .map_err(map_task_error)?;

        ReminderRepository::create_for_task(&tx, &task_id, &reminder_inputs)
            .map_err(map_reminder_error)?;

        tx.commit().map_err(|error| AppError::DatabaseError {
            message: error.to_string(),
        })?;

        Ok(task_to_dto(task))
    }

    pub fn update(connection: &Connection, input: UpdateTaskRequest) -> Result<TaskDto, AppError> {
        let existing = TaskRepository::get_by_id(connection, &input.id).map_err(map_task_error)?;
        validate_update_request(&existing, &input)?;

        let contact_update = ContactService::resolve_for_task_update(
            connection,
            input.contact_id,
            input.contact_snapshot,
        )?;

        let (contact_id, contact_snapshot) = match contact_update {
            Some(resolved) => (Some(resolved.contact_id), Some(resolved.contact_snapshot)),
            None => (None, None),
        };

        let task = TaskRepository::update(
            connection,
            &input.id,
            UpdateTaskInput {
                title: input.title,
                note: input.note,
                planned_at_ms: input.planned_at_ms,
                deadline_at_ms: input.deadline_at_ms,
                priority: input.priority,
                status: input.status.map(task_status_from_dto),
                contact_id,
                contact_snapshot,
                updated_at_ms: now_ms(),
            },
        )
        .map_err(map_task_error)?;

        Ok(task_to_dto(task))
    }

    pub fn get_detail(connection: &Connection, id: &str) -> Result<TaskDetailDto, AppError> {
        let task = TaskRepository::get_by_id(connection, id).map_err(map_task_error)?;
        let reminders =
            ReminderRepository::list_for_task(connection, id).map_err(map_reminder_error)?;
        let postponements = PostponementRepository::list_for_task(connection, id)
            .map_err(map_postponement_error)?;

        Ok(TaskDetailDto {
            task: task_to_dto(task),
            reminders: reminders.into_iter().map(reminder_to_dto).collect(),
            postponements: postponements.into_iter().map(postponement_to_dto).collect(),
        })
    }

    pub fn postpone(
        connection: &Connection,
        input: PostponeTaskRequest,
    ) -> Result<TaskDetailDto, AppError> {
        let task = TaskRepository::get_by_id(connection, &input.task_id).map_err(map_task_error)?;

        if task.status.is_terminal() {
            return Err(AppError::InvalidTaskInput {
                message: "terminal tasks cannot be postponed".to_string(),
            });
        }

        let Some(old_deadline_at_ms) = task.deadline_at_ms else {
            return Err(AppError::InvalidDeadline {
                message: "task must have a deadline before postponement".to_string(),
            });
        };

        validate_postpone_request(task.planned_at_ms, old_deadline_at_ms, &input)?;

        let now_ms = now_ms();
        let tx = connection
            .unchecked_transaction()
            .map_err(|error| AppError::DatabaseError {
                message: error.to_string(),
            })?;

        PostponementRepository::create(
            &tx,
            CreatePostponementInput {
                id: new_entity_id("postponement"),
                task_id: input.task_id.clone(),
                old_deadline_at_ms,
                new_deadline_at_ms: input.new_deadline_at_ms,
                reason: input.reason.trim().to_string(),
                created_at_ms: now_ms,
            },
        )
        .map_err(map_postponement_error)?;

        TaskRepository::update(
            &tx,
            &input.task_id,
            UpdateTaskInput {
                deadline_at_ms: Some(Some(input.new_deadline_at_ms)),
                updated_at_ms: now_ms,
                ..Default::default()
            },
        )
        .map_err(map_task_error)?;

        tx.commit().map_err(|error| AppError::DatabaseError {
            message: error.to_string(),
        })?;

        Self::get_detail(connection, &input.task_id)
    }

    pub fn get_by_id(connection: &Connection, id: &str) -> Result<TaskDto, AppError> {
        let task = TaskRepository::get_by_id(connection, id).map_err(map_task_error)?;
        Ok(task_to_dto(task))
    }

    pub fn query(
        connection: &Connection,
        query: TaskQueryRequest,
    ) -> Result<Vec<TaskDto>, AppError> {
        let tasks = TaskRepository::query(
            connection,
            TaskQuery {
                status: query.status.map(task_status_from_dto),
                priority: query.priority,
            },
        )
        .map_err(map_task_error)?;

        Ok(tasks.into_iter().map(task_to_dto).collect())
    }

    pub fn query_history_tasks(
        connection: &Connection,
        query: HistoryTasksQueryRequest,
    ) -> Result<Vec<TaskDto>, AppError> {
        let range = resolve_history_range(&query)?;
        let repository_query = build_history_task_query(connection, &query, range)?;
        let tasks =
            TaskRepository::query_history(connection, repository_query).map_err(map_task_error)?;

        Ok(tasks.into_iter().map(task_to_dto).collect())
    }

    pub fn query_today_tasks(connection: &Connection) -> Result<TodayTasksDto, AppError> {
        let as_of_ms = now_ms();
        let auto_started_task_ids =
            TaskRepository::start_due_tasks(connection, as_of_ms).map_err(map_task_error)?;
        let mut today = classify_today_tasks(connection, as_of_ms)?;
        today.auto_started_task_ids = auto_started_task_ids;
        Ok(today)
    }

    pub fn complete(connection: &Connection, id: &str) -> Result<TaskDto, AppError> {
        let task = TaskRepository::complete(connection, id, now_ms()).map_err(map_task_error)?;
        Ok(task_to_dto(task))
    }

    pub fn cancel(connection: &Connection, id: &str) -> Result<TaskDto, AppError> {
        let task = TaskRepository::cancel(connection, id, now_ms()).map_err(map_task_error)?;
        Ok(task_to_dto(task))
    }

    pub fn mark_custom_reminder_fired(
        connection: &Connection,
        reminder_id: &str,
        fired_at_ms: i64,
    ) -> Result<ReminderDto, AppError> {
        let reminder =
            ReminderRepository::get_by_id(connection, reminder_id).map_err(map_reminder_error)?;

        if reminder.fired_at_ms.is_some() {
            return Ok(reminder_to_dto(reminder));
        }

        let task =
            TaskRepository::get_by_id(connection, &reminder.task_id).map_err(map_task_error)?;
        if task.status == TaskStatus::Completed {
            return Err(AppError::InvalidTaskInput {
                message: "completed tasks cannot fire custom reminders".to_string(),
            });
        }
        if task.status == TaskStatus::Cancelled {
            return Err(AppError::InvalidTaskInput {
                message: "cancelled tasks cannot fire custom reminders".to_string(),
            });
        }

        let updated = ReminderRepository::mark_fired(connection, reminder_id, fired_at_ms)
            .map_err(map_reminder_error)?;
        Ok(reminder_to_dto(updated))
    }

    pub fn list_triggerable_custom_reminders(
        connection: &Connection,
    ) -> Result<Vec<ReminderDto>, AppError> {
        let reminders =
            ReminderRepository::list_triggerable(connection).map_err(map_reminder_error)?;
        Ok(reminders.into_iter().map(reminder_to_dto).collect())
    }
}

fn classify_today_tasks(connection: &Connection, as_of_ms: i64) -> Result<TodayTasksDto, AppError> {
    let today = calendar_day::local_date_from_ms(as_of_ms);
    let tasks = TaskRepository::query(connection, TaskQuery::default()).map_err(map_task_error)?;

    let mut formal_tasks = Vec::new();
    let mut upcoming_deadline_tasks = Vec::new();
    let mut overdue_tasks = Vec::new();
    let mut completed_today_tasks = Vec::new();

    for task in tasks {
        let dto = task_to_dto(task);

        if matches!(dto.status, TaskStatusDto::Completed) {
            if dto.completed_at_ms.is_some_and(|completed_at_ms| {
                calendar_day::is_same_local_calendar_day(completed_at_ms, today)
            }) {
                completed_today_tasks.push(dto);
            }
            continue;
        }

        if matches!(dto.status, TaskStatusDto::Cancelled) {
            continue;
        }

        let planned_today = calendar_day::is_same_local_calendar_day(dto.planned_at_ms, today);
        let deadline_today = dto.deadline_at_ms.is_some_and(|deadline_at_ms| {
            calendar_day::is_same_local_calendar_day(deadline_at_ms, today)
        });
        let is_historical_overdue = dto.deadline_at_ms.is_some_and(|deadline_at_ms| {
            calendar_day::is_local_calendar_day_before(deadline_at_ms, today)
        });

        if is_historical_overdue {
            overdue_tasks.push(dto.clone());
        }

        if planned_today || deadline_today {
            if dto
                .deadline_at_ms
                .is_some_and(|deadline_at_ms| deadline_at_ms > as_of_ms)
            {
                upcoming_deadline_tasks.push(dto.clone());
            }
            formal_tasks.push(dto);
        }
    }

    formal_tasks.sort_by(|left, right| match (left.deadline_at_ms, right.deadline_at_ms) {
        (Some(left_deadline), Some(right_deadline)) => left_deadline
            .cmp(&right_deadline)
            .then_with(|| left.id.cmp(&right.id)),
        (Some(_), None) => std::cmp::Ordering::Less,
        (None, Some(_)) => std::cmp::Ordering::Greater,
        (None, None) => left
            .planned_at_ms
            .cmp(&right.planned_at_ms)
            .then_with(|| left.id.cmp(&right.id)),
    });
    upcoming_deadline_tasks
        .sort_by_key(|task| (task.deadline_at_ms.unwrap_or(i64::MAX), task.id.clone()));
    overdue_tasks.sort_by_key(|task| (task.deadline_at_ms.unwrap_or(i64::MAX), task.id.clone()));
    completed_today_tasks.sort_by_key(|task| {
        (
            std::cmp::Reverse(task.completed_at_ms.unwrap_or(0)),
            task.id.clone(),
        )
    });

    Ok(TodayTasksDto {
        formal_tasks,
        upcoming_deadline_tasks,
        overdue_tasks,
        completed_today_tasks,
        auto_started_task_ids: Vec::new(),
    })
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn validate_create_request(input: &CreateTaskRequest) -> Result<(), AppError> {
    if input.planned_at_ms <= 0 {
        return Err(AppError::InvalidTaskInput {
            message: "planned time must be positive".to_string(),
        });
    }

    if let Some(deadline_at_ms) = input.deadline_at_ms {
        if deadline_at_ms <= 0 {
            return Err(AppError::InvalidTaskInput {
                message: "deadline must be positive when provided".to_string(),
            });
        }
        if deadline_at_ms < input.planned_at_ms {
            return Err(AppError::InvalidDeadline {
                message: "deadline must not be before planned time".to_string(),
            });
        }
    }

    if input.reminders.len() as i32 > MAX_USER_REMINDERS {
        return Err(AppError::ReminderLimitReached {
            limit: MAX_USER_REMINDERS,
        });
    }

    for reminder in &input.reminders {
        if reminder.remind_at_ms <= 0 {
            return Err(AppError::InvalidTaskInput {
                message: "reminder time must be positive".to_string(),
            });
        }
    }

    Ok(())
}

fn validate_update_request(existing: &Task, input: &UpdateTaskRequest) -> Result<(), AppError> {
    let planned_at_ms = input.planned_at_ms.unwrap_or(existing.planned_at_ms);
    let deadline_at_ms = match input.deadline_at_ms {
        Some(deadline) => deadline,
        None => existing.deadline_at_ms,
    };

    if let Some(deadline_at_ms) = deadline_at_ms {
        if deadline_at_ms <= 0 {
            return Err(AppError::InvalidTaskInput {
                message: "deadline must be positive when provided".to_string(),
            });
        }
        if deadline_at_ms < planned_at_ms {
            return Err(AppError::InvalidDeadline {
                message: "deadline must not be before planned time".to_string(),
            });
        }
    }

    Ok(())
}

fn validate_postpone_request(
    planned_at_ms: i64,
    old_deadline_at_ms: i64,
    input: &PostponeTaskRequest,
) -> Result<(), AppError> {
    if input.reason.trim().is_empty() {
        return Err(AppError::InvalidTaskInput {
            message: "postponement reason must not be empty".to_string(),
        });
    }

    if input.new_deadline_at_ms <= 0 {
        return Err(AppError::InvalidTaskInput {
            message: "new deadline must be positive".to_string(),
        });
    }

    if input.new_deadline_at_ms <= old_deadline_at_ms {
        return Err(AppError::InvalidDeadline {
            message: "new deadline must be later than the current deadline".to_string(),
        });
    }

    if input.new_deadline_at_ms < planned_at_ms {
        return Err(AppError::InvalidDeadline {
            message: "new deadline must not be before planned time".to_string(),
        });
    }

    Ok(())
}

fn build_reminder_inputs(
    task_id: &str,
    reminders: &[CreateTaskReminderRequest],
) -> Result<Vec<CreateReminderInput>, AppError> {
    reminders
        .iter()
        .map(|reminder| {
            Ok(CreateReminderInput {
                id: new_entity_id("reminder"),
                task_id: task_id.to_string(),
                remind_at_ms: reminder.remind_at_ms,
                message: normalize_optional_text(reminder.message.clone()),
            })
        })
        .collect()
}

fn now_ms() -> i64 {
    chrono::Local::now().timestamp_millis()
}

fn reminder_to_dto(reminder: TaskReminder) -> ReminderDto {
    ReminderDto {
        id: reminder.id,
        task_id: reminder.task_id,
        remind_at_ms: reminder.remind_at_ms,
        message: reminder.message,
        enabled: reminder.enabled,
        fired_at_ms: reminder.fired_at_ms,
    }
}

fn postponement_to_dto(postponement: Postponement) -> PostponementDto {
    PostponementDto {
        id: postponement.id,
        task_id: postponement.task_id,
        old_deadline_at_ms: postponement.old_deadline_at_ms,
        new_deadline_at_ms: postponement.new_deadline_at_ms,
        reason: postponement.reason,
        created_at_ms: postponement.created_at_ms,
    }
}

fn map_postponement_error(error: PostponementRepositoryError) -> AppError {
    match error {
        PostponementRepositoryError::InvalidInput { message } => {
            AppError::InvalidTaskInput { message }
        }
        PostponementRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

fn task_to_dto(task: Task) -> TaskDto {
    TaskDto {
        id: task.id,
        title: task.title,
        note: task.note,
        planned_at_ms: task.planned_at_ms,
        deadline_at_ms: task.deadline_at_ms,
        priority: task.priority,
        status: task_status_to_dto(task.status),
        contact_id: task.contact_id,
        contact_snapshot: task.contact_snapshot,
        created_at_ms: task.created_at_ms,
        completed_at_ms: task.completed_at_ms,
        cancelled_at_ms: task.cancelled_at_ms,
        updated_at_ms: task.updated_at_ms,
    }
}

pub(crate) fn map_task_entity_to_dto(task: Task) -> TaskDto {
    task_to_dto(task)
}

fn task_status_to_dto(status: TaskStatus) -> TaskStatusDto {
    match status {
        TaskStatus::NotStarted => TaskStatusDto::NotStarted,
        TaskStatus::InProgress => TaskStatusDto::InProgress,
        TaskStatus::Paused => TaskStatusDto::Paused,
        TaskStatus::Waiting => TaskStatusDto::Waiting,
        TaskStatus::Completed => TaskStatusDto::Completed,
        TaskStatus::Cancelled => TaskStatusDto::Cancelled,
    }
}

fn task_status_from_dto(status: TaskStatusDto) -> TaskStatus {
    match status {
        TaskStatusDto::NotStarted => TaskStatus::NotStarted,
        TaskStatusDto::InProgress => TaskStatus::InProgress,
        TaskStatusDto::Paused => TaskStatus::Paused,
        TaskStatusDto::Waiting => TaskStatus::Waiting,
        TaskStatusDto::Completed => TaskStatus::Completed,
        TaskStatusDto::Cancelled => TaskStatus::Cancelled,
    }
}

fn history_mode_from_dto(mode: HistoryTimeModeDto) -> HistoryTimeMode {
    match mode {
        HistoryTimeModeDto::Day => HistoryTimeMode::Day,
        HistoryTimeModeDto::Week => HistoryTimeMode::Week,
        HistoryTimeModeDto::Month => HistoryTimeMode::Month,
        HistoryTimeModeDto::Quarter => HistoryTimeMode::Quarter,
        HistoryTimeModeDto::Year => HistoryTimeMode::Year,
        HistoryTimeModeDto::Custom => HistoryTimeMode::Custom,
    }
}

fn resolve_history_range(
    query: &HistoryTasksQueryRequest,
) -> Result<history_range::HistoryTimeRange, AppError> {
    history_range::resolve_history_range(HistoryRangeInput {
        mode: history_mode_from_dto(query.mode),
        anchor_date: query.anchor_date.clone(),
        start_date: query.start_date.clone(),
        end_date: query.end_date.clone(),
    })
    .map_err(|message| AppError::InvalidTaskInput { message })
}

fn build_history_task_query(
    connection: &Connection,
    query: &HistoryTasksQueryRequest,
    range: history_range::HistoryTimeRange,
) -> Result<HistoryTaskQuery, AppError> {
    if let Some(priority) = query.priority {
        if !(1..=5).contains(&priority) {
            return Err(AppError::InvalidTaskInput {
                message: format!("task priority must be between 1 and 5, got {priority}"),
            });
        }
    }

    let keyword = query
        .keyword
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .map(|value| value.to_string());

    let (contact_id, contact_snapshot) = if let Some(contact_id) = query.contact_id.clone() {
        let contact =
            ContactRepository::get_by_id(connection, &contact_id).map_err(map_contact_error)?;
        (Some(contact.id), Some(contact.name))
    } else {
        (None, None)
    };

    Ok(HistoryTaskQuery {
        start_ms: range.start_ms,
        end_ms: range.end_ms,
        status: query.status.map(task_status_from_dto),
        priority: query.priority,
        contact_id,
        contact_snapshot,
        keyword,
    })
}

fn map_contact_error(
    error: crate::db::repositories::contact_repository::ContactRepositoryError,
) -> AppError {
    match error {
        crate::db::repositories::contact_repository::ContactRepositoryError::NotFound { id } => {
            AppError::InvalidTaskInput {
                message: format!("contact not found: {id}"),
            }
        }
        crate::db::repositories::contact_repository::ContactRepositoryError::InvalidInput {
            message,
        } => AppError::InvalidTaskInput { message },
        crate::db::repositories::contact_repository::ContactRepositoryError::Db(db_error) => {
            AppError::DatabaseError {
                message: db_error.to_string(),
            }
        }
    }
}

fn map_reminder_error(error: ReminderRepositoryError) -> AppError {
    match error {
        ReminderRepositoryError::InvalidInput { message } => AppError::InvalidTaskInput { message },
        ReminderRepositoryError::NotFound { id } => AppError::InvalidTaskInput {
            message: format!("reminder not found: {id}"),
        },
        ReminderRepositoryError::LimitReached { limit } => AppError::ReminderLimitReached { limit },
        ReminderRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

fn map_task_error(error: TaskRepositoryError) -> AppError {
    match error {
        TaskRepositoryError::NotFound { id } => AppError::TaskNotFound { id },
        TaskRepositoryError::InvalidInput { message } => AppError::InvalidTaskInput { message },
        TaskRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::task_repository::TaskRepository;

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

    #[test]
    fn query_today_tasks_starts_due_tasks_and_reports_changed_ids() {
        let db = open_test_database();
        let current_ms = now_ms();
        let due_at_ms = current_ms - 1;
        TaskRepository::create(
            &db.connection,
            CreateTaskInput {
                id: "due-now".to_string(),
                title: "Due now".to_string(),
                note: None,
                planned_at_ms: due_at_ms,
                deadline_at_ms: Some(current_ms + 1),
                priority: Some(3),
                contact_id: None,
                contact_snapshot: None,
                created_at_ms: due_at_ms - 60_000,
                updated_at_ms: due_at_ms - 60_000,
            },
        )
        .expect("create due task");

        let first = TaskService::query_today_tasks(&db.connection).expect("first query");
        assert_eq!(first.auto_started_task_ids, vec!["due-now"]);
        assert_eq!(first.formal_tasks[0].status, TaskStatusDto::InProgress);

        let second = TaskService::query_today_tasks(&db.connection).expect("second query");
        assert!(second.auto_started_task_ids.is_empty());
    }

    fn system_reminder_log_count(connection: &Connection) -> i64 {
        connection
            .query_row("SELECT COUNT(*) FROM system_reminder_log", [], |row| {
                row.get(0)
            })
            .expect("system reminder log count")
    }

    fn system_reminder_kinds(connection: &Connection) -> Vec<String> {
        let mut statement = connection
            .prepare("SELECT kind FROM system_reminder_log ORDER BY kind ASC")
            .expect("prepare kinds");
        statement
            .query_map([], |row| row.get(0))
            .expect("query kinds")
            .collect::<Result<Vec<String>, _>>()
            .expect("collect kinds")
    }

    #[test]
    fn get_detail_returns_task_and_reminders() {
        let db = open_test_database();
        let created = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Detail task".to_string(),
                note: Some("note".to_string()),
                planned_at_ms: 1_000,
                deadline_at_ms: Some(5_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![CreateTaskReminderRequest {
                    remind_at_ms: 2_000,
                    message: Some("ping".to_string()),
                }],
            },
        )
        .expect("create");

        let detail = TaskService::get_detail(&db.connection, &created.id).expect("detail");
        assert_eq!(detail.task.title, "Detail task");
        assert_eq!(detail.reminders.len(), 1);
        assert_eq!(detail.reminders[0].message.as_deref(), Some("ping"));
        assert!(detail.reminders[0].fired_at_ms.is_none());
        assert!(detail.postponements.is_empty());
    }

    #[test]
    fn postpone_updates_deadline_and_appends_history() {
        let db = open_test_database();
        let created = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Postpone me".to_string(),
                note: None,
                planned_at_ms: 10_000,
                deadline_at_ms: Some(20_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create");

        let detail = TaskService::postpone(
            &db.connection,
            PostponeTaskRequest {
                task_id: created.id.clone(),
                new_deadline_at_ms: 30_000,
                reason: "研发接口没给".to_string(),
            },
        )
        .expect("postpone");

        assert_eq!(detail.task.deadline_at_ms, Some(30_000));
        assert_eq!(detail.postponements.len(), 1);
        assert_eq!(detail.postponements[0].old_deadline_at_ms, 20_000);
        assert_eq!(detail.postponements[0].new_deadline_at_ms, 30_000);
        assert_eq!(detail.postponements[0].reason, "研发接口没给");
    }

    #[test]
    fn postpone_preserves_append_only_history() {
        let db = open_test_database();
        let created = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Twice".to_string(),
                note: None,
                planned_at_ms: 10_000,
                deadline_at_ms: Some(20_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create");

        TaskService::postpone(
            &db.connection,
            PostponeTaskRequest {
                task_id: created.id.clone(),
                new_deadline_at_ms: 30_000,
                reason: "first".to_string(),
            },
        )
        .expect("first postpone");

        let detail = TaskService::postpone(
            &db.connection,
            PostponeTaskRequest {
                task_id: created.id.clone(),
                new_deadline_at_ms: 40_000,
                reason: "second".to_string(),
            },
        )
        .expect("second postpone");

        assert_eq!(detail.task.deadline_at_ms, Some(40_000));
        assert_eq!(detail.postponements.len(), 2);
        assert_eq!(detail.postponements[0].reason, "first");
        assert_eq!(detail.postponements[1].reason, "second");
    }

    #[test]
    fn postpone_rejects_empty_reason() {
        let db = open_test_database();
        let created = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Reason required".to_string(),
                note: None,
                planned_at_ms: 10_000,
                deadline_at_ms: Some(20_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create");

        let error = TaskService::postpone(
            &db.connection,
            PostponeTaskRequest {
                task_id: created.id,
                new_deadline_at_ms: 30_000,
                reason: "   ".to_string(),
            },
        )
        .expect_err("empty reason");

        assert!(matches!(error, AppError::InvalidTaskInput { .. }));
    }

    #[test]
    fn postpone_rejects_terminal_task() {
        let db = open_test_database();
        let created = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Done".to_string(),
                note: None,
                planned_at_ms: 10_000,
                deadline_at_ms: Some(20_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create");
        TaskService::complete(&db.connection, &created.id).expect("complete");

        let error = TaskService::postpone(
            &db.connection,
            PostponeTaskRequest {
                task_id: created.id,
                new_deadline_at_ms: 30_000,
                reason: "too late".to_string(),
            },
        )
        .expect_err("terminal task");

        assert!(matches!(error, AppError::InvalidTaskInput { .. }));
    }

    #[test]
    fn update_rejects_deadline_before_planned_time() {
        let db = open_test_database();
        let created = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Update me".to_string(),
                note: None,
                planned_at_ms: 10_000,
                deadline_at_ms: Some(20_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create");

        let error = TaskService::update(
            &db.connection,
            UpdateTaskRequest {
                id: created.id,
                deadline_at_ms: Some(Some(5_000)),
                ..Default::default()
            },
        )
        .expect_err("invalid deadline");

        assert!(matches!(error, AppError::InvalidDeadline { .. }));
    }

    #[test]
    fn deactivate_keeps_task_contact_snapshot() {
        let db = open_test_database();
        let contact = crate::services::contact::ContactService::create(
            &db.connection,
            crate::services::contact::CreateContactRequest {
                name: "历史对接人".to_string(),
            },
        )
        .expect("create contact");

        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "With contact".to_string(),
                note: None,
                planned_at_ms: 8_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: Some(contact.id.clone()),
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create task");

        crate::services::contact::ContactService::deactivate(&db.connection, &contact.id)
            .expect("deactivate contact");

        let stored = TaskRepository::get_by_id(&db.connection, &task.id).expect("get task");
        assert_eq!(stored.contact_snapshot.as_deref(), Some("历史对接人"));
        assert_eq!(stored.contact_id.as_deref(), Some(contact.id.as_str()));
    }

    #[test]
    fn create_task_persists_user_reminders_in_transaction() {
        let db = open_test_database();
        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "With reminders".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: Some(5_000),
                priority: None,
                contact_id: None,
                contact_snapshot: Some("小王".to_string()),
                reminders: vec![
                    CreateTaskReminderRequest {
                        remind_at_ms: 2_000,
                        message: Some("先确认".to_string()),
                    },
                    CreateTaskReminderRequest {
                        remind_at_ms: 3_000,
                        message: None,
                    },
                ],
            },
        )
        .expect("create task with reminders");

        let count = ReminderRepository::count_for_task(&db.connection, &task.id).expect("count");
        assert_eq!(count, 2);
        assert_eq!(task.contact_snapshot.as_deref(), Some("小王"));
        assert!(task.contact_id.is_some());
    }

    #[test]
    fn create_task_rejects_deadline_before_planned_time() {
        let db = open_test_database();
        let error = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Bad deadline".to_string(),
                note: None,
                planned_at_ms: 5_000,
                deadline_at_ms: Some(4_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect_err("deadline before planned");

        assert!(matches!(error, AppError::InvalidDeadline { .. }));
        let json = serde_json::to_value(error).expect("serialize error");
        assert_eq!(json["code"], "INVALID_DEADLINE");
    }

    #[test]
    fn create_task_rejects_more_than_three_reminders() {
        let db = open_test_database();
        let error = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Too many reminders".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![
                    CreateTaskReminderRequest {
                        remind_at_ms: 1_100,
                        message: None,
                    },
                    CreateTaskReminderRequest {
                        remind_at_ms: 1_200,
                        message: None,
                    },
                    CreateTaskReminderRequest {
                        remind_at_ms: 1_300,
                        message: None,
                    },
                    CreateTaskReminderRequest {
                        remind_at_ms: 1_400,
                        message: None,
                    },
                ],
            },
        )
        .expect_err("too many reminders");

        assert!(matches!(error, AppError::ReminderLimitReached { .. }));
        let json = serde_json::to_value(error).expect("serialize error");
        assert_eq!(json["code"], "REMINDER_LIMIT_REACHED");
        assert_eq!(json["details"]["limit"], 3);
        assert_eq!(system_reminder_log_count(&db.connection), 0);
        let task_count: i64 = db
            .connection
            .query_row("SELECT COUNT(*) FROM tasks", [], |row| row.get(0))
            .expect("task count");
        assert_eq!(task_count, 0);
    }

    #[test]
    fn create_task_allows_three_custom_reminders() {
        let db = open_test_database();
        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Three reminders".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![
                    CreateTaskReminderRequest {
                        remind_at_ms: 1_100,
                        message: None,
                    },
                    CreateTaskReminderRequest {
                        remind_at_ms: 1_200,
                        message: None,
                    },
                    CreateTaskReminderRequest {
                        remind_at_ms: 1_300,
                        message: None,
                    },
                ],
            },
        )
        .expect("create with three reminders");

        let count = ReminderRepository::count_for_task(&db.connection, &task.id).expect("count");
        assert_eq!(count, 3);
        assert_eq!(system_reminder_log_count(&db.connection), 0);
        let kinds = system_reminder_kinds(&db.connection);
        assert!(kinds.is_empty());
    }

    #[test]
    fn mark_custom_reminder_fired_is_idempotent_and_does_not_write_system_log() {
        let db = open_test_database();
        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Fire reminder".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![CreateTaskReminderRequest {
                    remind_at_ms: 2_000,
                    message: Some("check".to_string()),
                }],
            },
        )
        .expect("create");
        let reminder_id = TaskService::get_detail(&db.connection, &task.id)
            .expect("detail")
            .reminders[0]
            .id
            .clone();

        let first = TaskService::mark_custom_reminder_fired(&db.connection, &reminder_id, 3_000)
            .expect("first fire");
        assert_eq!(first.fired_at_ms, Some(3_000));

        let second = TaskService::mark_custom_reminder_fired(&db.connection, &reminder_id, 9_000)
            .expect("second fire");
        assert_eq!(second.fired_at_ms, Some(3_000));

        let stored = TaskRepository::get_by_id(&db.connection, &task.id).expect("task unchanged");
        assert_eq!(stored.title, "Fire reminder");
        assert_eq!(stored.status, TaskStatus::NotStarted);
        assert_eq!(
            ReminderRepository::count_for_task(&db.connection, &task.id).expect("count"),
            1
        );
        assert_eq!(system_reminder_log_count(&db.connection), 0);
        assert!(system_reminder_kinds(&db.connection).is_empty());
    }

    #[test]
    fn completed_task_unfired_custom_reminder_is_not_triggerable() {
        let db = open_test_database();
        let open_task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Still open".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![CreateTaskReminderRequest {
                    remind_at_ms: 2_000,
                    message: None,
                }],
            },
        )
        .expect("create open");
        let done_task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Already done".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![CreateTaskReminderRequest {
                    remind_at_ms: 2_100,
                    message: None,
                }],
            },
        )
        .expect("create done");
        let done_reminder_id = TaskService::get_detail(&db.connection, &done_task.id)
            .expect("detail")
            .reminders[0]
            .id
            .clone();

        let completed = TaskService::complete(&db.connection, &done_task.id).expect("complete");
        assert_eq!(completed.status, TaskStatusDto::Completed);

        let triggerable =
            TaskService::list_triggerable_custom_reminders(&db.connection).expect("list");
        assert_eq!(triggerable.len(), 1);
        assert_eq!(triggerable[0].task_id, open_task.id);

        let error =
            TaskService::mark_custom_reminder_fired(&db.connection, &done_reminder_id, 4_000)
                .expect_err("completed cannot fire");
        assert!(matches!(error, AppError::InvalidTaskInput { .. }));
        assert_eq!(system_reminder_log_count(&db.connection), 0);
    }

    #[test]
    fn cancelled_task_unfired_custom_reminder_is_not_triggerable() {
        let db = open_test_database();
        let open_task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Still open".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![CreateTaskReminderRequest {
                    remind_at_ms: 2_000,
                    message: None,
                }],
            },
        )
        .expect("create open");
        let cancelled_task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Cancelled".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![CreateTaskReminderRequest {
                    remind_at_ms: 2_200,
                    message: None,
                }],
            },
        )
        .expect("create cancelled");
        let cancelled_reminder_id = TaskService::get_detail(&db.connection, &cancelled_task.id)
            .expect("detail")
            .reminders[0]
            .id
            .clone();

        let cancelled = TaskService::cancel(&db.connection, &cancelled_task.id).expect("cancel");
        assert_eq!(cancelled.status, TaskStatusDto::Cancelled);

        let triggerable =
            TaskService::list_triggerable_custom_reminders(&db.connection).expect("list");
        assert_eq!(triggerable.len(), 1);
        assert_eq!(triggerable[0].task_id, open_task.id);

        let error =
            TaskService::mark_custom_reminder_fired(&db.connection, &cancelled_reminder_id, 4_000)
                .expect_err("cancelled cannot fire");
        assert!(matches!(error, AppError::InvalidTaskInput { .. }));
        let json = serde_json::to_value(error).expect("serialize error");
        assert_eq!(
            json["details"]["message"],
            "cancelled tasks cannot fire custom reminders"
        );
    }

    #[test]
    fn update_and_complete_do_not_create_system_ddl_reminders() {
        let db = open_test_database();
        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "No system reminders".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: Some(5_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![CreateTaskReminderRequest {
                    remind_at_ms: 2_000,
                    message: None,
                }],
            },
        )
        .expect("create");

        TaskService::update(
            &db.connection,
            UpdateTaskRequest {
                id: task.id.clone(),
                title: Some("Updated title".to_string()),
                ..Default::default()
            },
        )
        .expect("update");
        TaskService::complete(&db.connection, &task.id).expect("complete");

        assert_eq!(
            ReminderRepository::count_for_task(&db.connection, &task.id).expect("count"),
            1
        );
        assert_eq!(system_reminder_log_count(&db.connection), 0);
        assert!(system_reminder_kinds(&db.connection).is_empty());
        let updated = TaskService::get_by_id(&db.connection, &task.id).expect("get");
        assert_eq!(updated.title, "Updated title");
        assert_eq!(updated.status, TaskStatusDto::Completed);
    }

    #[test]
    fn create_task_returns_camel_case_dto() {
        let db = open_test_database();
        let task = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Write report".to_string(),
                note: Some("details".to_string()),
                planned_at_ms: 1_700_000_000_000,
                deadline_at_ms: Some(1_700_003_600_000),
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create task");

        assert!(task.id.starts_with("task-"));
        assert_eq!(task.title, "Write report");
        assert_eq!(task.note.as_deref(), Some("details"));
        assert_eq!(task.priority, 2);
        assert_eq!(task.status, TaskStatusDto::NotStarted);
        assert_eq!(
            ReminderRepository::count_for_task(&db.connection, &task.id).expect("count"),
            0
        );
    }

    #[test]
    fn create_task_rejects_empty_title_with_structured_error() {
        let db = open_test_database();
        let error = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "   ".to_string(),
                note: None,
                planned_at_ms: 1_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect_err("empty title must fail");

        assert!(matches!(error, AppError::InvalidTaskInput { .. }));
        let json = serde_json::to_value(error).expect("serialize error");
        assert_eq!(json["code"], "INVALID_TASK_INPUT");
    }

    #[test]
    fn get_by_id_returns_task_not_found_error() {
        let db = open_test_database();
        let error = TaskService::get_by_id(&db.connection, "missing").expect_err("missing task");

        assert!(matches!(error, AppError::TaskNotFound { .. }));
        let json = serde_json::to_value(error).expect("serialize error");
        assert_eq!(json["code"], "TASK_NOT_FOUND");
        assert_eq!(json["details"]["id"], "missing");
    }

    #[test]
    fn query_filters_by_status() {
        let db = open_test_database();
        let created = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Filter me".to_string(),
                note: None,
                planned_at_ms: 2_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create task");
        TaskService::update(
            &db.connection,
            UpdateTaskRequest {
                id: created.id.clone(),
                status: Some(TaskStatusDto::InProgress),
                ..Default::default()
            },
        )
        .expect("update task");

        let in_progress = TaskService::query(
            &db.connection,
            TaskQueryRequest {
                status: Some(TaskStatusDto::InProgress),
                ..Default::default()
            },
        )
        .expect("query tasks");

        assert_eq!(in_progress.len(), 1);
        assert_eq!(in_progress[0].id, created.id);
    }

    #[test]
    fn complete_and_cancel_update_terminal_status() {
        let db = open_test_database();
        let created = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Finish".to_string(),
                note: None,
                planned_at_ms: 3_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create task");

        let completed = TaskService::complete(&db.connection, &created.id).expect("complete task");
        assert_eq!(completed.status, TaskStatusDto::Completed);
        assert!(completed.completed_at_ms.is_some());

        let reopened = TaskService::create(
            &db.connection,
            CreateTaskRequest {
                title: "Cancel me".to_string(),
                note: None,
                planned_at_ms: 4_000,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            },
        )
        .expect("create second task");
        let cancelled = TaskService::cancel(&db.connection, &reopened.id).expect("cancel task");
        assert_eq!(cancelled.status, TaskStatusDto::Cancelled);
        assert!(cancelled.cancelled_at_ms.is_some());
    }

    mod today_tasks {
        use super::*;
        use chrono::{Local, NaiveDateTime, TimeZone};

        use crate::db::repositories::task_repository::{CreateTaskInput, TaskRepository};

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

        fn query_at(connection: &Connection, as_of_ms: i64) -> TodayTasksDto {
            classify_today_tasks(connection, as_of_ms).expect("today tasks")
        }

        fn ids(tasks: &[TaskDto]) -> Vec<&str> {
            tasks.iter().map(|task| task.id.as_str()).collect()
        }

        const TODAY: &str = "2026-08-14";
        const TOMORROW: &str = "2026-08-15";
        const YESTERDAY: &str = "2026-08-13";

        #[test]
        fn planned_today_enters_formal_tasks() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "formal-planned",
                local_ms(TODAY, "09:00"),
                None,
            );

            let result = query_at(&db.connection, local_ms(TODAY, "15:00"));
            assert_eq!(ids(&result.formal_tasks), vec!["formal-planned"]);
            assert!(result.overdue_tasks.is_empty());
        }

        #[test]
        fn deadline_today_with_planned_tomorrow_enters_formal_tasks() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "formal-ddl-today",
                local_ms(TOMORROW, "09:00"),
                Some(local_ms(TODAY, "18:00")),
            );

            let result = query_at(&db.connection, local_ms(TODAY, "15:00"));
            assert_eq!(ids(&result.formal_tasks), vec!["formal-ddl-today"]);
            assert!(result.overdue_tasks.is_empty());
        }

        #[test]
        fn planned_and_deadline_both_today_appear_once() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "formal-once",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "18:00")),
            );

            let result = query_at(&db.connection, local_ms(TODAY, "15:00"));
            assert_eq!(result.formal_tasks.len(), 1);
            assert_eq!(result.formal_tasks[0].id, "formal-once");
        }

        #[test]
        fn today_deadline_passed_still_in_formal_not_historical_overdue() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "formal-ddl-passed-today",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "14:00")),
            );

            let result = query_at(&db.connection, local_ms(TODAY, "16:00"));
            assert_eq!(ids(&result.formal_tasks), vec!["formal-ddl-passed-today"]);
            assert!(result.overdue_tasks.is_empty());
            assert!(result.upcoming_deadline_tasks.is_empty());
        }

        #[test]
        fn yesterday_deadline_at_2359_is_historical_overdue_not_formal_by_ddl() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "overdue-late-yesterday",
                local_ms(YESTERDAY, "09:00"),
                Some(local_ms(YESTERDAY, "23:59")),
            );

            let result = query_at(&db.connection, local_ms(TODAY, "16:00"));
            assert_eq!(ids(&result.overdue_tasks), vec!["overdue-late-yesterday"]);
            assert!(result.formal_tasks.is_empty());
        }

        #[test]
        fn planned_today_with_yesterday_deadline_in_formal_and_overdue() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "dual-formal-overdue",
                local_ms(TODAY, "09:00"),
                Some(local_ms(YESTERDAY, "18:00")),
            );

            let result = query_at(&db.connection, local_ms(TODAY, "16:00"));
            assert_eq!(ids(&result.formal_tasks), vec!["dual-formal-overdue"]);
            assert_eq!(ids(&result.overdue_tasks), vec!["dual-formal-overdue"]);
            assert!(result.upcoming_deadline_tasks.is_empty());
        }

        #[test]
        fn yesterday_deadline_incomplete_goes_to_overdue_not_formal() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "overdue-yesterday",
                local_ms(YESTERDAY, "09:00"),
                Some(local_ms(YESTERDAY, "18:00")),
            );

            let result = query_at(&db.connection, local_ms(TODAY, "15:00"));
            assert_eq!(ids(&result.overdue_tasks), vec!["overdue-yesterday"]);
            assert!(result.formal_tasks.is_empty());
        }

        #[test]
        fn yesterday_deadline_completed_is_not_overdue() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "done-yesterday-ddl",
                local_ms(YESTERDAY, "09:00"),
                Some(local_ms(YESTERDAY, "18:00")),
            );
            TaskRepository::complete(
                &db.connection,
                "done-yesterday-ddl",
                local_ms(YESTERDAY, "19:00"),
            )
            .expect("complete");

            let result = query_at(&db.connection, local_ms(TODAY, "15:00"));
            assert!(result.overdue_tasks.is_empty());
            assert!(result.formal_tasks.is_empty());
        }

        #[test]
        fn cancelled_task_is_excluded_from_formal_and_overdue() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "cancelled-today",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "18:00")),
            );
            TaskRepository::cancel(&db.connection, "cancelled-today", local_ms(TODAY, "10:00"))
                .expect("cancel");

            let result = query_at(&db.connection, local_ms(TODAY, "15:00"));
            assert!(result.formal_tasks.is_empty());
            assert!(result.overdue_tasks.is_empty());
        }

        #[test]
        fn completed_today_enters_completed_today_tasks() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "completed-today",
                local_ms(TODAY, "09:00"),
                None,
            );
            TaskRepository::complete(&db.connection, "completed-today", local_ms(TODAY, "16:00"))
                .expect("complete");

            let result = query_at(&db.connection, local_ms(TODAY, "17:00"));
            assert_eq!(ids(&result.completed_today_tasks), vec!["completed-today"]);
            assert!(result.formal_tasks.is_empty());
        }

        #[test]
        fn completed_yesterday_is_not_in_completed_today_tasks() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "completed-yesterday",
                local_ms(YESTERDAY, "09:00"),
                None,
            );
            TaskRepository::complete(
                &db.connection,
                "completed-yesterday",
                local_ms(YESTERDAY, "16:00"),
            )
            .expect("complete");

            let result = query_at(&db.connection, local_ms(TODAY, "15:00"));
            assert!(result.completed_today_tasks.is_empty());
        }

        #[test]
        fn formal_tasks_put_deadlines_first_then_sort_undated_by_plan() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "undated-late",
                local_ms(TODAY, "14:00"),
                None,
            );
            insert_task(
                &db.connection,
                "future-late",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "20:00")),
            );
            insert_task(
                &db.connection,
                "past-due",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "14:00")),
            );
            insert_task(
                &db.connection,
                "future-soon",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "16:00")),
            );
            insert_task(
                &db.connection,
                "undated-early",
                local_ms(TODAY, "10:00"),
                None,
            );

            let result = query_at(&db.connection, local_ms(TODAY, "15:00"));

            assert_eq!(
                ids(&result.formal_tasks),
                vec![
                    "past-due",
                    "future-soon",
                    "future-late",
                    "undated-early",
                    "undated-late",
                ]
            );
        }

        #[test]
        fn upcoming_deadline_tasks_sort_by_deadline_ascending() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "upcoming-late",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "20:00")),
            );
            insert_task(
                &db.connection,
                "upcoming-soon",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "16:30")),
            );
            insert_task(
                &db.connection,
                "upcoming-mid",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "18:00")),
            );

            let result = query_at(&db.connection, local_ms(TODAY, "15:00"));
            assert_eq!(
                ids(&result.upcoming_deadline_tasks),
                vec!["upcoming-soon", "upcoming-mid", "upcoming-late"]
            );
        }

        #[test]
        fn today_tasks_survive_database_reopen() {
            let temp = tempfile::tempdir().expect("tempdir");
            let first = initialize_database(temp.path()).expect("initialize database");

            insert_task(
                &first,
                "persist-formal",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "18:00")),
            );
            insert_task(
                &first,
                "persist-overdue",
                local_ms(YESTERDAY, "09:00"),
                Some(local_ms(YESTERDAY, "18:00")),
            );
            insert_task(&first, "persist-completed", local_ms(TODAY, "08:00"), None);
            TaskRepository::complete(&first, "persist-completed", local_ms(TODAY, "11:00"))
                .expect("complete");

            let before = query_at(&first, local_ms(TODAY, "15:00"));
            drop(first);

            let reopened = initialize_database(temp.path()).expect("reopen database");
            let after = query_at(&reopened, local_ms(TODAY, "15:00"));

            assert_eq!(before, after);
        }
    }

    mod history_tasks {
        use super::*;
        use crate::db::repositories::task_repository::TaskRepository;
        use chrono::TimeZone;

        const TODAY: &str = "2026-08-18";
        const YESTERDAY: &str = "2026-08-17";
        const TOMORROW: &str = "2026-08-19";

        fn local_ms(date: &str, time: &str) -> i64 {
            let naive =
                chrono::NaiveDateTime::parse_from_str(&format!("{date} {time}"), "%Y-%m-%d %H:%M")
                    .expect("valid");
            chrono::Local
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
                    title: format!("Task {id}"),
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
            .expect("create task");
        }

        fn day_history_query(anchor: &str) -> HistoryTasksQueryRequest {
            HistoryTasksQueryRequest {
                mode: HistoryTimeModeDto::Day,
                anchor_date: Some(anchor.to_string()),
                start_date: None,
                end_date: None,
                status: None,
                priority: None,
                contact_id: None,
                keyword: None,
            }
        }

        #[test]
        fn day_filter_includes_completed_on_anchor_day_only() {
            let db = open_test_database();
            insert_task(&db.connection, "today-done", local_ms(TODAY, "09:00"), None);
            TaskRepository::complete(&db.connection, "today-done", local_ms(TODAY, "16:00"))
                .expect("complete today");
            insert_task(
                &db.connection,
                "yesterday-done",
                local_ms(YESTERDAY, "09:00"),
                None,
            );
            TaskRepository::complete(
                &db.connection,
                "yesterday-done",
                local_ms(YESTERDAY, "16:00"),
            )
            .expect("complete yesterday");
            insert_task(&db.connection, "active", local_ms(TODAY, "09:00"), None);

            let tasks = TaskService::query_history_tasks(&db.connection, day_history_query(TODAY))
                .expect("query day history");

            assert_eq!(tasks.len(), 1);
            assert_eq!(tasks[0].id, "today-done");
        }

        #[test]
        fn custom_range_rejects_start_after_end() {
            let db = open_test_database();
            let error = TaskService::query_history_tasks(
                &db.connection,
                HistoryTasksQueryRequest {
                    mode: HistoryTimeModeDto::Custom,
                    anchor_date: None,
                    start_date: Some(TOMORROW.to_string()),
                    end_date: Some(TODAY.to_string()),
                    status: None,
                    priority: None,
                    contact_id: None,
                    keyword: None,
                },
            )
            .expect_err("invalid custom range");

            assert!(matches!(error, AppError::InvalidTaskInput { .. }));
        }

        #[test]
        fn history_query_survives_database_reopen() {
            let temp = tempfile::tempdir().expect("tempdir");
            let first = initialize_database(temp.path()).expect("initialize database");
            insert_task(&first, "persist-history", local_ms(TODAY, "09:00"), None);
            TaskRepository::complete(&first, "persist-history", local_ms(TODAY, "11:00"))
                .expect("complete");

            let before = TaskService::query_history_tasks(&first, day_history_query(TODAY))
                .expect("query before reopen");
            drop(first);

            let reopened = initialize_database(temp.path()).expect("reopen database");
            let after = TaskService::query_history_tasks(&reopened, day_history_query(TODAY))
                .expect("query after reopen");

            assert_eq!(before, after);
        }

        #[test]
        fn planned_and_deadline_do_not_place_active_tasks_in_history() {
            let db = open_test_database();
            insert_task(
                &db.connection,
                "planned-today",
                local_ms(TODAY, "09:00"),
                Some(local_ms(TODAY, "18:00")),
            );

            let tasks = TaskService::query_history_tasks(&db.connection, day_history_query(TODAY))
                .expect("query day history");

            assert!(tasks.is_empty());
        }

        #[test]
        fn business_filters_combine_with_day_range() {
            let db = open_test_database();
            use crate::db::repositories::contact_repository::{
                ContactRepository, CreateContactInput,
            };

            ContactRepository::create(
                &db.connection,
                CreateContactInput {
                    id: "contact-a".to_string(),
                    name: "Alice".to_string(),
                    created_at_ms: local_ms(TODAY, "08:00"),
                    updated_at_ms: local_ms(TODAY, "08:00"),
                },
            )
            .expect("create contact");

            let urgent = CreateTaskInput {
                id: "urgent-done".to_string(),
                title: "Urgent report".to_string(),
                note: Some("deadline review".to_string()),
                planned_at_ms: local_ms(TODAY, "09:00"),
                deadline_at_ms: None,
                priority: Some(5),
                contact_id: Some("contact-a".to_string()),
                contact_snapshot: Some("Alice".to_string()),
                created_at_ms: local_ms(TODAY, "09:00"),
                updated_at_ms: local_ms(TODAY, "09:00"),
            };
            TaskRepository::create(&db.connection, urgent).expect("create urgent");
            TaskRepository::complete(&db.connection, "urgent-done", local_ms(TODAY, "16:00"))
                .expect("complete urgent");

            insert_task(&db.connection, "plain-done", local_ms(TODAY, "09:00"), None);
            TaskRepository::complete(&db.connection, "plain-done", local_ms(TODAY, "17:00"))
                .expect("complete plain");

            let filtered = TaskService::query_history_tasks(
                &db.connection,
                HistoryTasksQueryRequest {
                    mode: HistoryTimeModeDto::Day,
                    anchor_date: Some(TODAY.to_string()),
                    start_date: None,
                    end_date: None,
                    status: Some(TaskStatusDto::Completed),
                    priority: Some(5),
                    contact_id: Some("contact-a".to_string()),
                    keyword: Some("report".to_string()),
                },
            )
            .expect("combined filters");

            assert_eq!(filtered.len(), 1);
            assert_eq!(filtered[0].id, "urgent-done");
        }

        #[test]
        fn invalid_priority_is_rejected() {
            let db = open_test_database();
            let error = TaskService::query_history_tasks(
                &db.connection,
                HistoryTasksQueryRequest {
                    mode: HistoryTimeModeDto::Day,
                    anchor_date: Some(TODAY.to_string()),
                    start_date: None,
                    end_date: None,
                    status: None,
                    priority: Some(9),
                    contact_id: None,
                    keyword: None,
                },
            )
            .expect_err("invalid priority");

            assert!(matches!(error, AppError::InvalidTaskInput { .. }));
        }

        #[test]
        fn blank_keyword_is_ignored() {
            let db = open_test_database();
            insert_task(&db.connection, "done-task", local_ms(TODAY, "09:00"), None);
            TaskRepository::complete(&db.connection, "done-task", local_ms(TODAY, "16:00"))
                .expect("complete");

            let with_spaces = TaskService::query_history_tasks(
                &db.connection,
                HistoryTasksQueryRequest {
                    mode: HistoryTimeModeDto::Day,
                    anchor_date: Some(TODAY.to_string()),
                    start_date: None,
                    end_date: None,
                    status: None,
                    priority: None,
                    contact_id: None,
                    keyword: Some("   ".to_string()),
                },
            )
            .expect("blank keyword");

            assert_eq!(with_spaces.len(), 1);
        }
    }
}
