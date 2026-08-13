use serde::Serialize;

use crate::services::workspace_validator::ValidationFailure;

#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "details", rename_all = "camelCase")]
pub enum AppError {
    ValidationFailed { reason: ValidationFailure },
    WorkspaceNotFound { path: String },
    WorkspaceNotWritable { path: String, message: String },
    DatabaseInitFailed { message: String },
    DatabaseError { message: String },
    AppNotReady { message: String },
    TaskNotFound { id: String },
    ConfigReadFailed { message: String },
    ConfigWriteFailed { message: String },
    InvalidPath { message: String },
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ValidationFailed { reason } => write!(f, "workspace validation failed: {reason}"),
            Self::WorkspaceNotFound { path } => write!(f, "workspace not found: {path}"),
            Self::WorkspaceNotWritable { path, message } => {
                write!(f, "workspace not writable at {path}: {message}")
            }
            Self::DatabaseInitFailed { message } => {
                write!(f, "database initialization failed: {message}")
            }
            Self::DatabaseError { message } => write!(f, "database operation failed: {message}"),
            Self::AppNotReady { message } => write!(f, "app is not ready: {message}"),
            Self::TaskNotFound { id } => write!(f, "task not found: {id}"),
            Self::ConfigReadFailed { message } => write!(f, "failed to read config: {message}"),
            Self::ConfigWriteFailed { message } => write!(f, "failed to write config: {message}"),
            Self::InvalidPath { message } => write!(f, "invalid path: {message}"),
        }
    }
}

impl std::error::Error for AppError {}

impl From<ValidationFailure> for AppError {
    fn from(reason: ValidationFailure) -> Self {
        Self::ValidationFailed { reason }
    }
}
