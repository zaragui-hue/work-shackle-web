use tauri::State;

use crate::errors::AppError;
use crate::services::overtime::{ActiveOvertimeDto, OvertimeService};
use crate::services::workspace_switch::AppState;

#[tauri::command]
pub fn get_active_overtime(
    state: State<'_, AppState>,
) -> Result<Option<ActiveOvertimeDto>, AppError> {
    state.with_db_app(|connection| OvertimeService::get_active(connection))
}

#[tauri::command]
pub fn start_overtime(state: State<'_, AppState>) -> Result<ActiveOvertimeDto, AppError> {
    let now_ms = chrono::Local::now().timestamp_millis();
    state.with_db_app(|connection| OvertimeService::start(connection, now_ms))
}

#[tauri::command]
pub fn end_overtime(state: State<'_, AppState>) -> Result<(), AppError> {
    let now_ms = chrono::Local::now().timestamp_millis();
    state.with_db_app(|connection| OvertimeService::end_manual(connection, now_ms))
}
