use tauri::State;

use crate::errors::AppError;
use crate::services::calendar::{
    CalendarDayTaskCountDto, CalendarService, CalendarTaskCountQueryRequest,
};
use crate::services::workspace_switch::AppState;

#[tauri::command]
pub fn query_calendar_task_counts(
    state: State<'_, AppState>,
    query: CalendarTaskCountQueryRequest,
) -> Result<Vec<CalendarDayTaskCountDto>, AppError> {
    state.with_db_app(|connection| CalendarService::query_task_counts(connection, query))
}
