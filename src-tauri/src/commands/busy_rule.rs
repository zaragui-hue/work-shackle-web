use tauri::State;

use crate::errors::AppError;
use crate::services::busy_rule::{BusyLevelDto, BusyRuleService};
use crate::services::busy_rule_validation::SaveBusyRulesRequest;
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

#[tauri::command]
pub fn reset_busy_rules_to_default(
    state: State<'_, AppState>,
) -> Result<Vec<BusyLevelDto>, AppError> {
    state.with_db_app(BusyRuleService::reset_busy_rules_to_default)
}
