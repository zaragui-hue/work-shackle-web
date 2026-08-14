use tauri::State;

use crate::errors::AppError;
use crate::services::work_status::{
    CurrentWorkStatusDto, FixedWorkStatusDto, SaveStatusCopyRequest, StatusCopyDto,
    SwitchWorkStatusRequest, WorkStatusService,
};
use crate::services::workspace_switch::AppState;

#[tauri::command]
pub fn list_work_statuses() -> Vec<FixedWorkStatusDto> {
    WorkStatusService::list_fixed_statuses()
}

#[tauri::command]
pub fn get_current_work_status(
    state: State<'_, AppState>,
) -> Result<Option<CurrentWorkStatusDto>, AppError> {
    state.with_db_app(|connection| WorkStatusService::get_current(connection))
}

#[tauri::command]
pub fn switch_work_status(
    state: State<'_, AppState>,
    input: SwitchWorkStatusRequest,
) -> Result<CurrentWorkStatusDto, AppError> {
    state.with_db_app(|connection| WorkStatusService::switch(connection, input))
}

#[tauri::command]
pub fn list_status_copies(
    state: State<'_, AppState>,
    status_type: String,
) -> Result<Vec<StatusCopyDto>, AppError> {
    state.with_db_app(|connection| WorkStatusService::list_copies(connection, &status_type))
}

#[tauri::command]
pub fn save_status_copy(
    state: State<'_, AppState>,
    input: SaveStatusCopyRequest,
) -> Result<StatusCopyDto, AppError> {
    state.with_db_app(|connection| WorkStatusService::save_copy(connection, input))
}
