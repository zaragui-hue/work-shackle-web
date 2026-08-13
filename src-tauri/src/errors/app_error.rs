use std::path::Path;

use serde::Serialize;

use crate::services::workspace_validator::ValidationFailure;

pub mod codes {
    pub const VALIDATION_FAILED: &str = "VALIDATION_FAILED";
    pub const WORKSPACE_NOT_FOUND: &str = "WORKSPACE_NOT_FOUND";
    pub const WORKSPACE_NOT_WRITABLE: &str = "WORKSPACE_NOT_WRITABLE";
    pub const DB_OPEN_FAILED: &str = "DB_OPEN_FAILED";
    pub const DB_MIGRATION_FAILED: &str = "DB_MIGRATION_FAILED";
    pub const DATABASE_ERROR: &str = "DATABASE_ERROR";
    pub const APP_NOT_READY: &str = "APP_NOT_READY";
    pub const TASK_NOT_FOUND: &str = "TASK_NOT_FOUND";
    pub const CONFIG_READ_FAILED: &str = "CONFIG_READ_FAILED";
    pub const CONFIG_WRITE_FAILED: &str = "CONFIG_WRITE_FAILED";
    pub const INVALID_PATH: &str = "INVALID_PATH";
    pub const WORKSPACE_TARGET_NOT_EMPTY: &str = "WORKSPACE_TARGET_NOT_EMPTY";
    pub const WORKSPACE_SWITCH_FAILED: &str = "WORKSPACE_SWITCH_FAILED";
    pub const WORKSPACE_NETWORK_DRIVE_UNSUPPORTED: &str = "WORKSPACE_NETWORK_DRIVE_UNSUPPORTED";
    pub const WORKSPACE_REMOVABLE_DRIVE_UNSUPPORTED: &str = "WORKSPACE_REMOVABLE_DRIVE_UNSUPPORTED";
    pub const WORKSPACE_DRIVE_TYPE_UNKNOWN: &str = "WORKSPACE_DRIVE_TYPE_UNKNOWN";
}

#[derive(Debug, Serialize)]
#[serde(tag = "code", content = "details")]
pub enum AppError {
    #[serde(rename = "VALIDATION_FAILED")]
    ValidationFailed { reason: ValidationFailure },
    #[serde(rename = "WORKSPACE_NOT_FOUND")]
    WorkspaceNotFound { path: String },
    #[serde(rename = "WORKSPACE_NOT_WRITABLE")]
    WorkspaceNotWritable { path: String, message: String },
    #[serde(rename = "DB_OPEN_FAILED")]
    DatabaseOpenFailed { message: String },
    #[serde(rename = "DB_MIGRATION_FAILED")]
    DatabaseMigrationFailed { message: String },
    #[serde(rename = "DATABASE_ERROR")]
    DatabaseError { message: String },
    #[serde(rename = "APP_NOT_READY")]
    AppNotReady { message: String },
    #[serde(rename = "TASK_NOT_FOUND")]
    TaskNotFound { id: String },
    #[serde(rename = "CONFIG_READ_FAILED")]
    ConfigReadFailed { message: String },
    #[serde(rename = "CONFIG_WRITE_FAILED")]
    ConfigWriteFailed { message: String },
    #[serde(rename = "INVALID_PATH")]
    InvalidPath { message: String },
    #[serde(rename = "WORKSPACE_TARGET_NOT_EMPTY")]
    WorkspaceTargetNotEmpty { path: String },
    #[serde(rename = "WORKSPACE_SWITCH_FAILED")]
    WorkspaceSwitchFailed { message: String },
    #[serde(rename = "WORKSPACE_NETWORK_DRIVE_UNSUPPORTED")]
    WorkspaceNetworkDriveUnsupported { path: String },
    #[serde(rename = "WORKSPACE_REMOVABLE_DRIVE_UNSUPPORTED")]
    WorkspaceRemovableDriveUnsupported { path: String },
    #[serde(rename = "WORKSPACE_DRIVE_TYPE_UNKNOWN")]
    WorkspaceDriveTypeUnknown { path: String },
}

impl AppError {
    pub fn from_workspace_validation(path: &Path, reason: ValidationFailure) -> Self {
        let path = path.to_string_lossy().into_owned();
        match reason {
            ValidationFailure::NetworkMount => Self::WorkspaceNetworkDriveUnsupported { path },
            ValidationFailure::RemovableMount => Self::WorkspaceRemovableDriveUnsupported { path },
            ValidationFailure::UnknownDrive => Self::WorkspaceDriveTypeUnknown { path },
            reason => Self::ValidationFailed { reason },
        }
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ValidationFailed { reason } => write!(f, "workspace validation failed: {reason}"),
            Self::WorkspaceNotFound { path } => write!(f, "workspace not found: {path}"),
            Self::WorkspaceNotWritable { path, message } => {
                write!(f, "workspace not writable at {path}: {message}")
            }
            Self::DatabaseOpenFailed { message } => {
                write!(f, "database open failed: {message}")
            }
            Self::DatabaseMigrationFailed { message } => {
                write!(f, "database migration failed: {message}")
            }
            Self::DatabaseError { message } => write!(f, "database operation failed: {message}"),
            Self::AppNotReady { message } => write!(f, "app is not ready: {message}"),
            Self::TaskNotFound { id } => write!(f, "task not found: {id}"),
            Self::ConfigReadFailed { message } => write!(f, "failed to read config: {message}"),
            Self::ConfigWriteFailed { message } => write!(f, "failed to write config: {message}"),
            Self::InvalidPath { message } => write!(f, "invalid path: {message}"),
            Self::WorkspaceTargetNotEmpty { path } => {
                write!(f, "workspace target is not empty: {path}")
            }
            Self::WorkspaceSwitchFailed { message } => {
                write!(f, "workspace switch failed: {message}")
            }
            Self::WorkspaceNetworkDriveUnsupported { path } => {
                write!(f, "network workspace drives are not supported: {path}")
            }
            Self::WorkspaceRemovableDriveUnsupported { path } => {
                write!(f, "removable workspace drives are not supported: {path}")
            }
            Self::WorkspaceDriveTypeUnknown { path } => {
                write!(f, "workspace drive type is invalid or unknown: {path}")
            }
        }
    }
}

impl std::error::Error for AppError {}

impl From<ValidationFailure> for AppError {
    fn from(reason: ValidationFailure) -> Self {
        Self::ValidationFailed { reason }
    }
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use super::*;

    #[test]
    fn phase1_app_errors_serialize_stable_ipc_codes() {
        let cases = [
            (
                AppError::ValidationFailed {
                    reason: ValidationFailure::UncPath,
                },
                codes::VALIDATION_FAILED,
            ),
            (
                AppError::WorkspaceNotFound {
                    path: "/tmp/missing".to_string(),
                },
                codes::WORKSPACE_NOT_FOUND,
            ),
            (
                AppError::WorkspaceNotWritable {
                    path: "/tmp/readonly".to_string(),
                    message: "directory is not writable".to_string(),
                },
                codes::WORKSPACE_NOT_WRITABLE,
            ),
            (
                AppError::DatabaseOpenFailed {
                    message: "sqlite open failed".to_string(),
                },
                codes::DB_OPEN_FAILED,
            ),
            (
                AppError::DatabaseMigrationFailed {
                    message: "migration failed".to_string(),
                },
                codes::DB_MIGRATION_FAILED,
            ),
            (
                AppError::DatabaseError {
                    message: "database operation failed".to_string(),
                },
                codes::DATABASE_ERROR,
            ),
            (
                AppError::AppNotReady {
                    message: "database is not initialized".to_string(),
                },
                codes::APP_NOT_READY,
            ),
            (
                AppError::ConfigReadFailed {
                    message: "config read failed".to_string(),
                },
                codes::CONFIG_READ_FAILED,
            ),
            (
                AppError::ConfigWriteFailed {
                    message: "config write failed".to_string(),
                },
                codes::CONFIG_WRITE_FAILED,
            ),
            (
                AppError::InvalidPath {
                    message: "invalid path".to_string(),
                },
                codes::INVALID_PATH,
            ),
            (
                AppError::WorkspaceTargetNotEmpty {
                    path: "/tmp/target".to_string(),
                },
                codes::WORKSPACE_TARGET_NOT_EMPTY,
            ),
            (
                AppError::WorkspaceSwitchFailed {
                    message: "switch failed".to_string(),
                },
                codes::WORKSPACE_SWITCH_FAILED,
            ),
        ];

        for (error, expected_code) in cases {
            let json = serde_json::to_value(error).expect("serialize app error");
            assert_eq!(json["code"], expected_code);
        }
    }

    #[test]
    fn unsupported_windows_drive_types_use_top_level_structured_error_codes() {
        let cases = [
            (
                ValidationFailure::NetworkMount,
                codes::WORKSPACE_NETWORK_DRIVE_UNSUPPORTED,
            ),
            (
                ValidationFailure::RemovableMount,
                codes::WORKSPACE_REMOVABLE_DRIVE_UNSUPPORTED,
            ),
            (
                ValidationFailure::UnknownDrive,
                codes::WORKSPACE_DRIVE_TYPE_UNKNOWN,
            ),
        ];

        for (reason, expected_code) in cases {
            let error = AppError::from_workspace_validation(Path::new(r"Z:\Work Shackle"), reason);
            let json = serde_json::to_value(error).expect("serialize app error");
            assert_eq!(json["code"], expected_code);
            assert_eq!(json["details"]["path"], r"Z:\Work Shackle");
        }
    }
}
