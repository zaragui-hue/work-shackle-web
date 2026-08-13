use std::path::{Path, PathBuf};

use chrono::Local;
use rusqlite::Connection;
use serde::Serialize;

use crate::db::connection::{open_connection, DbError};
use crate::db::migrations::run_migrations;
use crate::errors::AppError;
use crate::services::workspace::{
    default_workspace_path, initialize_current_week_directory, initialize_workspace_data_directory,
    load_app_config, AppConfig, WorkspaceContext, WorkspaceSource,
};
use crate::services::workspace_validator::{ValidationFailure, WorkspaceValidator};
use crate::time::week_folder::{week_folder_info_for_date, week_folder_relative_path};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(tag = "code", content = "details")]
pub enum StartupWarning {
    #[serde(rename = "WEEK_FOLDER_UNAVAILABLE")]
    WeekFolderUnavailable { path: String, message: String },
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartupReady {
    pub workspace_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub warning: Option<StartupWarning>,
}

pub fn run_startup(
    app_config_dir: &Path,
    ctx: &WorkspaceContext,
    validator: &WorkspaceValidator,
) -> Result<(StartupReady, Connection), AppError> {
    let config = load_app_config(app_config_dir)
        .map_err(|message| AppError::ConfigReadFailed { message })?;

    let (workspace_path, source) = resolve_for_startup(&config, ctx)?;

    match source {
        WorkspaceSource::Configured => validator
            .validate_existing(&workspace_path)
            .map_err(|reason| map_validation_error(&workspace_path, reason))?,
        WorkspaceSource::Default => validator
            .validate(&workspace_path)
            .map_err(|reason| map_validation_error(&workspace_path, reason))?,
    }

    initialize_workspace_data_directory(&workspace_path).map_err(|message| {
        AppError::WorkspaceNotWritable {
            path: path_to_string(&workspace_path),
            message,
        }
    })?;

    let connection = open_and_migrate_database(&workspace_path)?;
    perform_startup_checks(&connection).map_err(map_open_db_error)?;

    let today = Local::now().date_naive();
    let warning = initialize_current_week_directory(&workspace_path, today)
        .err()
        .map(|message| {
            let week_info = week_folder_info_for_date(today);
            let path = workspace_path.join(week_folder_relative_path(&week_info));
            StartupWarning::WeekFolderUnavailable {
                path: path_to_string(&path),
                message,
            }
        });

    Ok((
        StartupReady {
            workspace_path: path_to_string(&workspace_path),
            warning,
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

    let foreign_keys: i64 =
        connection.pragma_query_value(None, "foreign_keys", |row| row.get(0))?;
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
        _ => AppError::from_workspace_validation(path, reason),
    }
}

fn open_and_migrate_database(workspace: &Path) -> Result<Connection, AppError> {
    let mut connection = open_connection(workspace).map_err(map_open_db_error)?;
    run_migrations(&mut connection).map_err(map_migration_db_error)?;
    Ok(connection)
}

fn map_open_db_error(error: DbError) -> AppError {
    AppError::DatabaseOpenFailed {
        message: error.to_string(),
    }
}

fn map_migration_db_error(error: DbError) -> AppError {
    AppError::DatabaseMigrationFailed {
        message: error.to_string(),
    }
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::{database_path, initialize_database};
    use crate::services::workspace::{
        build_workspace_status, save_app_config, set_workspace_path, WORKSPACE_FOLDER_NAME,
    };
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
        assert!(PathBuf::from(&first.workspace_path)
            .join(".data/work-shackle.db")
            .is_file());
    }

    #[test]
    fn unconfigured_status_is_read_only_and_startup_still_creates_default_workspace() {
        let temp = tempfile::tempdir().expect("tempdir");
        let config_dir = temp.path().join("config");
        let ctx = mac_context(&temp.path().join("Documents"));
        let validator = WorkspaceValidator::real();
        let default_path = default_workspace_path(&ctx);

        let status =
            build_workspace_status(&config_dir, &ctx, &validator).expect("workspace status");
        assert_eq!(status.source, WorkspaceSource::Default);
        assert!(!default_path.exists());

        let (ready, connection) =
            run_startup(&config_dir, &ctx, &validator).expect("initialize default workspace");
        drop(connection);

        assert_eq!(ready.workspace_path, path_to_string(&default_path));
        assert!(default_path.join(".data/work-shackle.db").is_file());
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
        let serialized = serde_json::to_value(&err).expect("serialize startup error");
        assert_eq!(
            serialized["code"],
            crate::errors::codes::WORKSPACE_NOT_FOUND
        );
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
        let (ready, _) =
            run_startup(&config_dir, &ctx, &WorkspaceValidator::real()).expect("startup");
        assert_eq!(
            ready.workspace_path,
            workspace.to_string_lossy().into_owned()
        );
        assert_eq!(ready.warning, None);
    }

    #[test]
    fn healthy_database_starts_when_current_week_directory_cannot_be_created() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("configured");
        fs::create_dir_all(&workspace).expect("create workspace");
        let config_dir = temp.path().join("config");
        set_workspace_path(&config_dir, &workspace, &WorkspaceValidator::real())
            .expect("persist workspace");

        let database = initialize_database(&workspace).expect("initialize healthy database");
        database
            .execute(
                "INSERT INTO contacts
                 (id, name, is_active, created_at_ms, updated_at_ms)
                 VALUES ('contact-1', 'Preserved', 1, 1, 1)",
                [],
            )
            .expect("insert persisted record");
        drop(database);

        let today = Local::now().date_naive();
        let week = week_folder_info_for_date(today);
        fs::write(
            workspace.join(format!("{:04}", week.year)),
            "year path blocker",
        )
        .expect("create year-directory conflict");

        let ctx = mac_context(&temp.path().join("Documents"));
        let (ready, connection) = run_startup(&config_dir, &ctx, &WorkspaceValidator::real())
            .expect("healthy database should start in degraded folder state");
        let warning = ready.warning.expect("folder warning");
        assert!(matches!(
            &warning,
            StartupWarning::WeekFolderUnavailable { path, message }
                if path.starts_with(workspace.to_string_lossy().as_ref())
                    && !message.is_empty()
        ));
        let warning_json = serde_json::to_value(warning).expect("serialize warning");
        assert_eq!(warning_json["code"], "WEEK_FOLDER_UNAVAILABLE");

        let name: String = connection
            .query_row(
                "SELECT name FROM contacts WHERE id = 'contact-1'",
                [],
                |row| row.get(0),
            )
            .expect("read preserved database record");
        assert_eq!(name, "Preserved");
        drop(connection);

        let reopened = initialize_database(&workspace).expect("reopen healthy database");
        let reopened_name: String = reopened
            .query_row(
                "SELECT name FROM contacts WHERE id = 'contact-1'",
                [],
                |row| row.get(0),
            )
            .expect("read record after degraded startup closes");
        assert_eq!(reopened_name, "Preserved");
    }

    #[test]
    fn migration_failure_remains_a_database_startup_failure() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("configured");
        fs::create_dir_all(workspace.join(".data")).expect("create data directory");
        let config_dir = temp.path().join("config");
        set_workspace_path(&config_dir, &workspace, &WorkspaceValidator::real())
            .expect("persist workspace");

        let malformed = Connection::open(database_path(&workspace)).expect("open malformed db");
        malformed
            .execute_batch("CREATE TABLE schema_migrations (wrong_column INTEGER);")
            .expect("create incompatible migration metadata");
        drop(malformed);

        let today = Local::now().date_naive();
        let week = week_folder_info_for_date(today);
        let week_dir = workspace.join(week_folder_relative_path(&week));
        let ctx = mac_context(&temp.path().join("Documents"));
        let error = run_startup(&config_dir, &ctx, &WorkspaceValidator::real())
            .expect_err("migration failure must not become a folder warning");

        assert!(matches!(error, AppError::DatabaseMigrationFailed { .. }));
        let serialized = serde_json::to_value(&error).expect("serialize migration error");
        assert_eq!(
            serialized["code"],
            crate::errors::codes::DB_MIGRATION_FAILED
        );
        assert!(!week_dir.exists());
    }

    #[test]
    fn configured_readonly_workspace_returns_not_writable() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let temp = tempfile::tempdir().expect("tempdir");
            let workspace = temp.path().join("readonly");
            fs::create_dir_all(&workspace).expect("create workspace");
            let mut permissions = fs::metadata(&workspace).expect("metadata").permissions();
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
            let serialized = serde_json::to_value(&err).expect("serialize startup error");
            assert_eq!(
                serialized["code"],
                crate::errors::codes::WORKSPACE_NOT_WRITABLE
            );
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
        assert!(matches!(
            err,
            AppError::WorkspaceNetworkDriveUnsupported { path }
                if path == workspace.to_string_lossy()
        ));
    }
}
