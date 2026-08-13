use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use tauri::{AppHandle, Manager, State};

use crate::db::connection::DbError;
use crate::errors::AppError;
use crate::services::startup::{run_startup, StartupReady};
use crate::services::workspace::{
    build_workspace_status, resolve_workspace_path, set_workspace_path, WorkspaceContext,
    WorkspaceStatus,
};
use crate::services::workspace_validator::WorkspaceValidator;

pub struct AppState {
    pub db: Mutex<Option<Connection>>,
    pub workspace_path: Mutex<Option<String>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: Mutex::new(None),
            workspace_path: Mutex::new(None),
        }
    }

    pub fn with_db<T>(
        &self,
        operation: impl FnOnce(&Connection) -> Result<T, DbError>,
    ) -> Result<T, AppError> {
        let guard = self.db.lock().map_err(|_| AppError::AppNotReady {
            message: "failed to lock database state".to_string(),
        })?;
        let connection = guard.as_ref().ok_or_else(|| AppError::AppNotReady {
            message: "database is not initialized".to_string(),
        })?;
        operation(connection).map_err(|error| AppError::DatabaseError {
            message: error.to_string(),
        })
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[tauri::command]
pub fn initialize_app(app: AppHandle, state: State<'_, AppState>) -> Result<StartupReady, AppError> {
    if let Ok(workspace_path) = state.workspace_path.lock() {
        if let Some(path) = workspace_path.clone() {
            return Ok(StartupReady { workspace_path: path });
        }
    }

    let app_config_dir = app_config_dir(&app)?;
    let ctx = WorkspaceContext::from_system();
    let validator = WorkspaceValidator::real();
    let (ready, connection) = run_startup(&app_config_dir, &ctx, &validator)?;

    *state
        .workspace_path
        .lock()
        .map_err(|_| AppError::DatabaseInitFailed {
            message: "failed to lock startup state".to_string(),
        })? = Some(ready.workspace_path.clone());
    *state.db.lock().map_err(|_| AppError::DatabaseInitFailed {
        message: "failed to lock database state".to_string(),
    })? = Some(connection);

    Ok(ready)
}

#[tauri::command]
pub fn get_workspace_status(app: AppHandle) -> Result<WorkspaceStatus, AppError> {
    let app_config_dir = app_config_dir(&app)?;
    let ctx = WorkspaceContext::from_system();
    let validator = WorkspaceValidator::real();
    build_workspace_status(&app_config_dir, &ctx, &validator).map_err(|message| {
        AppError::ConfigReadFailed { message }
    })
}

#[tauri::command]
pub fn validate_workspace_candidate(path: String) -> Result<(), String> {
    let candidate = PathBuf::from(path);
    WorkspaceValidator::real()
        .validate(&candidate)
        .map_err(|failure| failure.to_string())
}

#[tauri::command]
pub fn set_workspace_path_command(app: AppHandle, path: String) -> Result<WorkspaceStatus, AppError> {
    let app_config_dir = app_config_dir(&app)?;
    let candidate = PathBuf::from(&path);
    let validator = WorkspaceValidator::real();

    set_workspace_path(&app_config_dir, &candidate, &validator)?;

    let ctx = WorkspaceContext::from_system();
    build_workspace_status(&app_config_dir, &ctx, &validator).map_err(|message| {
        AppError::ConfigReadFailed { message }
    })
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
