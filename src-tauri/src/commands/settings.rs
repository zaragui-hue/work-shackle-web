use chrono::Local;
use tauri::State;

use crate::errors::AppError;
use crate::services::lunch_reminder::{LunchReminderDto, LunchReminderService};
use crate::services::settings::{LunchScheduleDto, SaveLunchTimesRequest};
use crate::services::settings::{SaveWorkTimesRequest, SettingsService, WorkScheduleDto};
use crate::services::workspace_switch::AppState;

#[tauri::command]
pub fn get_work_schedule(state: State<'_, AppState>) -> Result<WorkScheduleDto, AppError> {
    let today = Local::now().date_naive();
    state.with_db_app(|connection| SettingsService::get_work_schedule(connection, today))
}

#[tauri::command]
pub fn save_default_work_times(
    state: State<'_, AppState>,
    input: SaveWorkTimesRequest,
) -> Result<WorkScheduleDto, AppError> {
    state.with_db_app(|connection| SettingsService::save_default_work_times(connection, input))
}

#[tauri::command]
pub fn save_today_work_override(
    state: State<'_, AppState>,
    input: SaveWorkTimesRequest,
) -> Result<WorkScheduleDto, AppError> {
    state.with_db_app(|connection| SettingsService::save_today_work_override(connection, input))
}

#[tauri::command]
pub fn clear_today_work_override(state: State<'_, AppState>) -> Result<WorkScheduleDto, AppError> {
    state.with_db_app(|connection| SettingsService::clear_today_work_override(connection))
}

#[tauri::command]
pub fn get_lunch_schedule(state: State<'_, AppState>) -> Result<LunchScheduleDto, AppError> {
    state.with_db_app(SettingsService::get_lunch_schedule)
}

#[tauri::command]
pub fn save_lunch_times(
    state: State<'_, AppState>,
    input: SaveLunchTimesRequest,
) -> Result<LunchScheduleDto, AppError> {
    state.with_db_app(|connection| SettingsService::save_lunch_times(connection, input))
}

#[tauri::command]
pub fn check_lunch_reminder(
    state: State<'_, AppState>,
) -> Result<Option<LunchReminderDto>, AppError> {
    let now_ms = chrono::Local::now().timestamp_millis();
    state.with_db_app(|connection| LunchReminderService::check(connection, now_ms))
}
