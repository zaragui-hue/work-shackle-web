use tauri::State;

use crate::errors::AppError;
use crate::services::contact::{ContactDto, ContactService, CreateContactRequest};
use crate::services::workspace_switch::AppState;

#[tauri::command]
pub fn list_contacts(state: State<'_, AppState>) -> Result<Vec<ContactDto>, AppError> {
    state.with_db_app(|connection| ContactService::list_active(connection))
}

#[tauri::command]
pub fn create_contact(
    state: State<'_, AppState>,
    input: CreateContactRequest,
) -> Result<ContactDto, AppError> {
    state.with_db_app(|connection| ContactService::create(connection, input))
}

#[tauri::command]
pub fn deactivate_contact(state: State<'_, AppState>, id: String) -> Result<ContactDto, AppError> {
    state.with_db_app(|connection| ContactService::deactivate(connection, &id))
}
