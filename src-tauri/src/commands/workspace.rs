use std::path::PathBuf;

use tauri::{AppHandle, Manager, State};

use crate::errors::AppError;
use crate::services::overtime_runtime::start_runtime_checker;
use crate::services::startup::StartupReady;
use crate::services::workspace::{
    build_workspace_status, resolve_workspace_path, WorkspaceContext, WorkspaceStatus,
};
use crate::services::workspace_validator::WorkspaceValidator;

pub use crate::services::workspace_switch::AppState;

#[tauri::command]
pub fn initialize_app(
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<StartupReady, AppError> {
    let app_config_dir = app_config_dir(&app)?;
    let ctx = WorkspaceContext::from_system();
    let validator = WorkspaceValidator::real();
    let ready = state.initialize(&app_config_dir, &ctx, &validator)?;
    start_runtime_checker(app);
    Ok(ready)
}

#[tauri::command]
pub fn get_workspace_status(app: AppHandle) -> Result<WorkspaceStatus, AppError> {
    let app_config_dir = app_config_dir(&app)?;
    let ctx = WorkspaceContext::from_system_read_only();
    let validator = WorkspaceValidator::real();
    build_workspace_status(&app_config_dir, &ctx, &validator)
}

#[tauri::command]
pub fn validate_workspace_candidate(path: String) -> Result<(), AppError> {
    let candidate = PathBuf::from(path);
    WorkspaceValidator::real()
        .validate(&candidate)
        .map_err(|reason| AppError::from_workspace_validation(&candidate, reason))
}

#[tauri::command]
pub fn set_workspace_path_command(
    app: AppHandle,
    state: State<'_, AppState>,
    path: String,
) -> Result<WorkspaceStatus, AppError> {
    let app_config_dir = app_config_dir(&app)?;
    let candidate = PathBuf::from(&path);
    let validator = WorkspaceValidator::real();
    state.switch_workspace(&app_config_dir, &candidate, &validator)
}

#[tauri::command]
pub fn resolve_default_workspace_path() -> String {
    let ctx = WorkspaceContext::from_system();
    let (path, _) = resolve_workspace_path(None, &ctx);
    path.to_string_lossy().into_owned()
}

fn app_config_dir(app: &AppHandle) -> Result<PathBuf, AppError> {
    app.path()
        .app_config_dir()
        .map_err(|error| AppError::ConfigReadFailed {
            message: error.to_string(),
        })
}

#[cfg(test)]
mod tests {
    use crate::services::workspace::AppConfig;

    #[test]
    fn app_config_only_stores_workspace_path_field() {
        let config = AppConfig {
            workspace_path: Some("/tmp/work".to_string()),
        };
        let json = serde_json::to_string(&config).expect("serialize");
        assert!(json.contains("workspacePath"));
        assert!(!json.contains("tasks"));
    }
}
