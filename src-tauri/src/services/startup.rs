use std::path::{Path, PathBuf};

use chrono::Local;
use rusqlite::Connection;
use serde::Serialize;

use crate::db::connection::{initialize_database, DbError};
use crate::errors::AppError;
use crate::services::workspace::{
    default_workspace_path, initialize_workspace_directories, load_app_config, AppConfig,
    WorkspaceContext, WorkspaceSource,
};
use crate::services::workspace_validator::{ValidationFailure, WorkspaceValidator};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupReady {
    pub workspace_path: String,
}

pub fn run_startup(
    app_config_dir: &Path,
    ctx: &WorkspaceContext,
    validator: &WorkspaceValidator,
) -> Result<(StartupReady, Connection), AppError> {
    let config = load_app_config(app_config_dir).map_err(|message| AppError::ConfigReadFailed {
        message,
    })?;

    let (workspace_path, source) = resolve_for_startup(&config, ctx)?;

    match source {
        WorkspaceSource::Configured => validator
            .validate_existing(&workspace_path)
            .map_err(|reason| map_validation_error(&workspace_path, reason))?,
        WorkspaceSource::Default => validator
            .validate(&workspace_path)
            .map_err(|reason| map_validation_error(&workspace_path, reason))?,
    }

    let today = Local::now().date_naive();
    initialize_workspace_directories(&workspace_path, today).map_err(|message| {
        AppError::WorkspaceNotWritable {
            path: path_to_string(&workspace_path),
            message,
        }
    })?;

    let connection = initialize_database(&workspace_path).map_err(map_db_error)?;
    perform_startup_checks(&connection).map_err(map_db_error)?;

    Ok((
        StartupReady {
            workspace_path: path_to_string(&workspace_path),
        },
        connection,
    ))
}

fn resolve_for_startup(
    config: &AppConfig,
    ctx: &WorkspaceContext,
) -> Result<(PathBuf, WorkspaceSource), AppError> {
    if let Some(path_str) = config
        .workspace_path
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        let path = PathBuf::from(path_str);
        if !path.exists() {
            return Err(AppError::WorkspaceNotFound {
                path: path_str.to_string(),
            });
        }
        return Ok((path, WorkspaceSource::Configured));
    }

    Ok((default_workspace_path(ctx), WorkspaceSource::Default))
}

fn perform_startup_checks(connection: &Connection) -> Result<(), DbError> {
    connection.query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
        row.get::<_, i64>(0)
    })?;

    let foreign_keys: i64 = connection.pragma_query_value(None, "foreign_keys", |row| {
        row.get(0)
    })?;
    if foreign_keys != 1 {
        return Err(DbError::Sqlite(rusqlite::Error::InvalidQuery));
    }

    Ok(())
}

fn map_validation_error(path: &Path, reason: ValidationFailure) -> AppError {
    match reason {
        ValidationFailure::NotWritable | ValidationFailure::CannotCreate => {
            AppError::WorkspaceNotWritable {
                path: path_to_string(path),
                message: reason.to_string(),
            }
        }
        _ => AppError::ValidationFailed { reason },
    }
}

fn map_db_error(error: DbError) -> AppError {
    AppError::DatabaseInitFailed {
        message: error.to_string(),
    }
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::workspace::{save_app_config, set_workspace_path, WORKSPACE_FOLDER_NAME};
    use std::collections::HashMap;
    use std::fs;

    fn mac_context(documents: &Path) -> WorkspaceContext {
        WorkspaceContext {
            documents_dir: documents.to_path_buf(),
            d_drive_root: None,
            d_drive_writable: false,
        }
    }

    #[test]
    fn default_workspace_startup_is_idempotent() {
        let temp = tempfile::tempdir().expect("tempdir");
        let config_dir = temp.path().join("config");
        let ctx = mac_context(&temp.path().join("Documents"));
        let validator = WorkspaceValidator::real();

        let (first, connection) =
            run_startup(&config_dir, &ctx, &validator).expect("first startup");
        drop(connection);

        let (second, _) = run_startup(&config_dir, &ctx, &validator).expect("second startup");
        assert_eq!(first, second);
        assert!(PathBuf::from(&first.workspace_path).join(".data/work-shackle.db").is_file());
    }

    #[test]
    fn configured_missing_workspace_returns_not_found_without_creating_default() {
        let temp = tempfile::tempdir().expect("tempdir");
        let config_dir = temp.path().join("config");
        let missing = temp.path().join("missing-workspace");
        let default_path = temp.path().join("Documents").join(WORKSPACE_FOLDER_NAME);

        save_app_config(
            &config_dir,
            &AppConfig {
                workspace_path: Some(missing.to_string_lossy().into_owned()),
            },
        )
        .expect("save config");

        let ctx = mac_context(&temp.path().join("Documents"));
        let err = run_startup(&config_dir, &ctx, &WorkspaceValidator::real())
            .expect_err("missing configured workspace should fail");

        assert!(matches!(err, AppError::WorkspaceNotFound { .. }));
        assert!(!default_path.exists());
        assert!(!missing.exists());
    }

    #[test]
    fn configured_existing_workspace_startup_succeeds() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("configured");
        fs::create_dir_all(&workspace).expect("create workspace");
        let config_dir = temp.path().join("config");
        set_workspace_path(&config_dir, &workspace, &WorkspaceValidator::real())
            .expect("persist workspace");

        let ctx = mac_context(&temp.path().join("Documents"));
        let (ready, _) = run_startup(&config_dir, &ctx, &WorkspaceValidator::real())
            .expect("startup");
        assert_eq!(
            ready.workspace_path,
            workspace.to_string_lossy().into_owned()
        );
    }

    #[test]
    fn configured_readonly_workspace_returns_not_writable() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let temp = tempfile::tempdir().expect("tempdir");
            let workspace = temp.path().join("readonly");
            fs::create_dir_all(&workspace).expect("create workspace");
            let mut permissions = fs::metadata(&workspace)
                .expect("metadata")
                .permissions();
            permissions.set_mode(0o555);
            fs::set_permissions(&workspace, permissions).expect("set permissions");

            let config_dir = temp.path().join("config");
            save_app_config(
                &config_dir,
                &AppConfig {
                    workspace_path: Some(workspace.to_string_lossy().into_owned()),
                },
            )
            .expect("save config");

            let ctx = mac_context(&temp.path().join("Documents"));
            let err = run_startup(&config_dir, &ctx, &WorkspaceValidator::real())
                .expect_err("readonly workspace should fail");
            assert!(matches!(err, AppError::WorkspaceNotWritable { .. }));
        }
    }

    #[test]
    fn validator_rejects_network_mount_during_startup() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("network");
        fs::create_dir_all(&workspace).expect("create workspace");
        let config_dir = temp.path().join("config");
        set_workspace_path(&config_dir, &workspace, &WorkspaceValidator::real())
            .expect("persist workspace");

        let validator = WorkspaceValidator::with_mount_map(HashMap::from([(
            temp.path().to_path_buf(),
            crate::services::workspace_validator::MountKind::Network,
        )]));
        let ctx = mac_context(&temp.path().join("Documents"));
        let err = run_startup(&config_dir, &ctx, &validator).expect_err("network mount");
        assert!(matches!(err, AppError::ValidationFailed { .. }));
    }
}
