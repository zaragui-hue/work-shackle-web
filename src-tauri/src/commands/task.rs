use tauri::State;

use crate::errors::AppError;
use crate::services::task::{
    CreateTaskRequest, HistoryTasksQueryRequest, PostponeTaskRequest, TaskDetailDto, TaskDto,
    TaskQueryRequest, TaskService, TodayTasksDto, UpdateTaskRequest,
};
use crate::services::workspace_switch::AppState;

#[tauri::command]
pub fn create_task(
    state: State<'_, AppState>,
    input: CreateTaskRequest,
) -> Result<TaskDto, AppError> {
    state.with_db_app(|connection| TaskService::create(connection, input))
}

#[tauri::command]
pub fn update_task(
    state: State<'_, AppState>,
    input: UpdateTaskRequest,
) -> Result<TaskDto, AppError> {
    state.with_db_app(|connection| TaskService::update(connection, input))
}

#[tauri::command]
pub fn get_task_detail(state: State<'_, AppState>, id: String) -> Result<TaskDetailDto, AppError> {
    state.with_db_app(|connection| TaskService::get_detail(connection, &id))
}

#[tauri::command]
pub fn get_task_by_id(state: State<'_, AppState>, id: String) -> Result<TaskDto, AppError> {
    state.with_db_app(|connection| TaskService::get_by_id(connection, &id))
}

#[tauri::command]
pub fn query_tasks(
    state: State<'_, AppState>,
    query: TaskQueryRequest,
) -> Result<Vec<TaskDto>, AppError> {
    state.with_db_app(|connection| TaskService::query(connection, query))
}

#[tauri::command]
pub fn query_history_tasks(
    state: State<'_, AppState>,
    query: HistoryTasksQueryRequest,
) -> Result<Vec<TaskDto>, AppError> {
    state.with_db_app(|connection| TaskService::query_history_tasks(connection, query))
}

#[tauri::command]
pub fn query_today_tasks(state: State<'_, AppState>) -> Result<TodayTasksDto, AppError> {
    state.with_db_app(|connection| TaskService::query_today_tasks(connection))
}

#[tauri::command]
pub fn complete_task(state: State<'_, AppState>, id: String) -> Result<TaskDto, AppError> {
    state.with_db_app(|connection| TaskService::complete(connection, &id))
}

#[tauri::command]
pub fn cancel_task(state: State<'_, AppState>, id: String) -> Result<TaskDto, AppError> {
    state.with_db_app(|connection| TaskService::cancel(connection, &id))
}

#[tauri::command]
pub fn postpone_task(
    state: State<'_, AppState>,
    input: PostponeTaskRequest,
) -> Result<TaskDetailDto, AppError> {
    state.with_db_app(|connection| TaskService::postpone(connection, input))
}
