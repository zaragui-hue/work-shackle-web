use tauri::State;

use crate::errors::AppError;
use crate::services::work_end_decision::{WorkEndDecisionService, WorkEndStateDto};
use crate::services::workspace_switch::AppState;

#[tauri::command]
pub fn get_work_end_state(state: State<'_, AppState>) -> Result<WorkEndStateDto, AppError> {
    let now_ms = chrono::Local::now().timestamp_millis();
    state.with_db_app(|connection| WorkEndDecisionService::get_state(connection, now_ms))
}

#[tauri::command]
pub fn confirm_normal_off_work(state: State<'_, AppState>) -> Result<WorkEndStateDto, AppError> {
    let now_ms = chrono::Local::now().timestamp_millis();
    state.with_db_app(|connection| WorkEndDecisionService::confirm_normal_off(connection, now_ms))
}
