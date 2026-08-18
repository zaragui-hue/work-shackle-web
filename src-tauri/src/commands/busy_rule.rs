use tauri::State;

use crate::errors::AppError;
use crate::services::busy_rule::{BusyLevelDto, BusyRuleService, SaveBusyRulesRequest};
use crate::services::workspace_switch::AppState;

#[tauri::command]
pub fn get_busy_rules(state: State<'_, AppState>) -> Result<Vec<BusyLevelDto>, AppError> {
    state.with_db_app(BusyRuleService::get_busy_rules)
}

#[tauri::command]
pub fn save_busy_rules(
    state: State<'_, AppState>,
    input: SaveBusyRulesRequest,
) -> Result<Vec<BusyLevelDto>, AppError> {
    state.with_db_app(|connection| BusyRuleService::save_busy_rules(connection, input))
}
