use std::collections::BTreeMap;
use std::fs::{self, OpenOptions};
use std::io;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;

use chrono::Local;
use rusqlite::{backup::Backup, Connection};

use crate::db::connection::{open_connection, DbError, DATABASE_FILE_NAME};
use crate::db::migrations::run_migrations;
use crate::errors::AppError;

use super::reminder_engine::ReminderEngineService;
use super::startup::{run_startup, StartupReady, StartupWarning};
use super::workspace::{
    assert_workspace_directory_exists, initialize_workspace_directories, load_app_config,
    save_app_config, AppConfig, WorkspaceContext, WorkspaceSource, WorkspaceStatus,
};
use super::workspace_validator::{ValidationFailure, WorkspaceValidator};

#[derive(Debug)]
pub enum WorkspaceSwitchError {
    TargetNotEmpty { path: PathBuf },
    InvalidTargetRelation { path: PathBuf },
    Io(std::io::Error),
    Database(DbError),
    Sqlite(rusqlite::Error),
    Validation(ValidationFailure),
    Verification(String),
}

impl std::fmt::Display for WorkspaceSwitchError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TargetNotEmpty { path } => {
                write!(
                    formatter,
                    "workspace target is not empty: {}",
                    path.display()
                )
            }
            Self::InvalidTargetRelation { path } => write!(
                formatter,
                "workspace target overlaps the active workspace: {}",
                path.display()
            ),
            Self::Io(error) => write!(formatter, "workspace copy failed: {error}"),
            Self::Database(error) => write!(formatter, "workspace database failed: {error}"),
            Self::Sqlite(error) => write!(formatter, "workspace sqlite copy failed: {error}"),
            Self::Validation(error) => write!(formatter, "workspace validation failed: {error}"),
            Self::Verification(message) => {
                write!(formatter, "workspace verification failed: {message}")
            }
        }
    }
}

impl std::error::Error for WorkspaceSwitchError {}

impl From<std::io::Error> for WorkspaceSwitchError {
    fn from(error: std::io::Error) -> Self {
        Self::Io(error)
    }
}

impl From<DbError> for WorkspaceSwitchError {
    fn from(error: DbError) -> Self {
        Self::Database(error)
    }
}

impl From<rusqlite::Error> for WorkspaceSwitchError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Sqlite(error)
    }
}

impl From<ValidationFailure> for WorkspaceSwitchError {
    fn from(error: ValidationFailure) -> Self {
        Self::Validation(error)
    }
}

pub struct ActiveWorkspace {
    path: PathBuf,
    connection: Connection,
    startup_warning: Option<StartupWarning>,
    reminder_cutoff_ms: i64,
}

pub struct AppState {
    active: Mutex<Option<ActiveWorkspace>>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            active: Mutex::new(None),
        }
    }

    pub fn initialize(
        &self,
        app_config_dir: &Path,
        ctx: &WorkspaceContext,
        validator: &WorkspaceValidator,
    ) -> Result<StartupReady, AppError> {
        let mut active = self.active.lock().map_err(|_| AppError::AppNotReady {
            message: "failed to lock startup state".to_string(),
        })?;
        if let Some(current) = active.as_ref() {
            return Ok(StartupReady {
                workspace_path: current.path.to_string_lossy().into_owned(),
                warning: current.startup_warning.clone(),
            });
        }

        let (ready, connection) = run_startup(app_config_dir, ctx, validator)?;
        let cutoff_ms = Local::now().timestamp_millis();
        ReminderEngineService::reconcile_at_startup(&connection, cutoff_ms)?;
        *active = Some(ActiveWorkspace {
            path: PathBuf::from(&ready.workspace_path),
            connection,
            startup_warning: ready.warning.clone(),
            reminder_cutoff_ms: cutoff_ms,
        });
        Ok(ready)
    }

    pub fn run_reminder_tick(
        &self,
        now_ms: i64,
    ) -> Result<crate::services::reminder_engine::ReminderEngineTickResult, AppError> {
        let guard = self.active.lock().map_err(|_| AppError::AppNotReady {
            message: "failed to lock database state".to_string(),
        })?;
        let active = guard.as_ref().ok_or_else(|| AppError::AppNotReady {
            message: "database is not initialized".to_string(),
        })?;
        assert_workspace_directory_exists(&active.path)?;
        ReminderEngineService::tick(&active.connection, now_ms, active.reminder_cutoff_ms)
    }

    #[cfg(test)]
    pub fn set_active_for_test(&self, workspace: &Path, cutoff_ms: i64) -> Result<(), AppError> {
        use crate::db::connection::initialize_database;

        let mut active = self.active.lock().map_err(|_| AppError::AppNotReady {
            message: "failed to lock startup state".to_string(),
        })?;
        *active = Some(ActiveWorkspace {
            path: workspace.to_path_buf(),
            connection: initialize_database(workspace).map_err(|error| {
                AppError::DatabaseError {
                    message: error.to_string(),
                }
            })?,
            startup_warning: None,
            reminder_cutoff_ms: cutoff_ms,
        });
        Ok(())
    }

    pub fn with_db<T>(
        &self,
        operation: impl FnOnce(&Connection) -> Result<T, DbError>,
    ) -> Result<T, AppError> {
        let guard = self.active.lock().map_err(|_| AppError::AppNotReady {
            message: "failed to lock database state".to_string(),
        })?;
        let active = guard.as_ref().ok_or_else(|| AppError::AppNotReady {
            message: "database is not initialized".to_string(),
        })?;
        assert_workspace_directory_exists(&active.path)?;
        operation(&active.connection).map_err(|error| AppError::DatabaseError {
            message: error.to_string(),
        })
    }

    pub fn with_db_app<T>(
        &self,
        operation: impl FnOnce(&Connection) -> Result<T, AppError>,
    ) -> Result<T, AppError> {
        let guard = self.active.lock().map_err(|_| AppError::AppNotReady {
            message: "failed to lock database state".to_string(),
        })?;
        let active = guard.as_ref().ok_or_else(|| AppError::AppNotReady {
            message: "database is not initialized".to_string(),
        })?;
        assert_workspace_directory_exists(&active.path)?;
        operation(&active.connection)
    }

    pub fn switch_workspace(
        &self,
        app_config_dir: &Path,
        candidate: &Path,
        validator: &WorkspaceValidator,
    ) -> Result<WorkspaceStatus, AppError> {
        self.switch_workspace_with_operations(
            app_config_dir,
            candidate,
            validator,
            prepare_workspace_switch,
            save_app_config,
        )
    }

    fn switch_workspace_with_operations<P, W>(
        &self,
        app_config_dir: &Path,
        candidate: &Path,
        validator: &WorkspaceValidator,
        prepare: P,
        write_config: W,
    ) -> Result<WorkspaceStatus, AppError>
    where
        P: FnOnce(
            &Path,
            &Connection,
            &Path,
            &WorkspaceValidator,
        ) -> Result<PreparedWorkspace, WorkspaceSwitchError>,
        W: FnOnce(&Path, &AppConfig) -> Result<(), String>,
    {
        let mut active_guard = self.active.lock().map_err(|_| AppError::AppNotReady {
            message: "failed to lock workspace state".to_string(),
        })?;
        let mut config = load_app_config(app_config_dir)
            .map_err(|message| AppError::ConfigReadFailed { message })?;

        let Some(current) = active_guard.as_ref() else {
            validator
                .validate(candidate)
                .map_err(|reason| AppError::from_workspace_validation(candidate, reason))?;
            config.workspace_path = Some(candidate.to_string_lossy().into_owned());
            write_config(app_config_dir, &config)
                .map_err(|message| AppError::ConfigWriteFailed { message })?;
            return Ok(configured_workspace_status(candidate));
        };

        if paths_equivalent(&current.path, candidate) {
            return Ok(configured_workspace_status(&current.path));
        }

        let prepared = prepare(&current.path, &current.connection, candidate, validator)
            .map_err(|error| map_workspace_switch_error(error, candidate))?;
        config.workspace_path = Some(candidate.to_string_lossy().into_owned());

        let PreparedWorkspace {
            path,
            connection,
            target_existed,
        } = prepared;
        let cutoff_ms = Local::now().timestamp_millis();
        ReminderEngineService::reconcile_at_startup(&connection, cutoff_ms)?;
        let old_active = active_guard
            .replace(ActiveWorkspace {
                path,
                connection,
                startup_warning: None,
                reminder_cutoff_ms: cutoff_ms,
            })
            .expect("active workspace was checked before replacement");

        if let Err(message) = write_config(app_config_dir, &config) {
            let failed_new = active_guard
                .replace(old_active)
                .expect("new workspace was installed before config commit");
            let failed_path = failed_new.path.clone();
            drop(failed_new.connection);
            let message = match cleanup_prepared_target(&failed_path, target_existed) {
                Ok(()) => message,
                Err(cleanup_error) => {
                    format!(
                        "{message}; cleanup failed for {}: {cleanup_error}",
                        failed_path.display()
                    )
                }
            };
            return Err(AppError::ConfigWriteFailed { message });
        }

        drop(old_active);
        Ok(configured_workspace_status(candidate))
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

fn paths_equivalent(left: &Path, right: &Path) -> bool {
    if left == right {
        return true;
    }
    match (left.canonicalize(), right.canonicalize()) {
        (Ok(left), Ok(right)) => left == right,
        _ => false,
    }
}

fn configured_workspace_status(path: &Path) -> WorkspaceStatus {
    let path = path.to_string_lossy().into_owned();
    WorkspaceStatus {
        configured_path: Some(path.clone()),
        resolved_path: path,
        source: WorkspaceSource::Configured,
        is_valid: true,
        validation_error: None,
    }
}

fn map_workspace_switch_error(error: WorkspaceSwitchError, candidate: &Path) -> AppError {
    match error {
        WorkspaceSwitchError::TargetNotEmpty { path } => AppError::WorkspaceTargetNotEmpty {
            path: path.to_string_lossy().into_owned(),
        },
        WorkspaceSwitchError::Validation(reason) => {
            AppError::from_workspace_validation(candidate, reason)
        }
        other => AppError::WorkspaceSwitchFailed {
            message: other.to_string(),
        },
    }
}

pub struct PreparedWorkspace {
    pub path: PathBuf,
    pub connection: Connection,
    target_existed: bool,
}

pub fn prepare_workspace_switch(
    old_workspace: &Path,
    old_connection: &Connection,
    target_workspace: &Path,
    validator: &WorkspaceValidator,
) -> Result<PreparedWorkspace, WorkspaceSwitchError> {
    let resolved_old = resolve_path_without_creating(old_workspace)?;
    let resolved_target = resolve_path_without_creating(target_workspace)?;
    if resolved_target.starts_with(&resolved_old) || resolved_old.starts_with(&resolved_target) {
        return Err(WorkspaceSwitchError::InvalidTargetRelation {
            path: target_workspace.to_path_buf(),
        });
    }

    validator.validate_location(target_workspace)?;
    let target_parent = target_workspace.parent().ok_or_else(|| {
        WorkspaceSwitchError::Verification("workspace target has no parent directory".to_string())
    })?;
    fs::create_dir_all(target_parent)?;
    validator.validate_existing(target_parent)?;

    let target_existed = target_workspace.exists();
    if target_existed {
        validator.validate_existing(target_workspace)?;
        if directory_has_entries(target_workspace)? {
            return Err(WorkspaceSwitchError::TargetNotEmpty {
                path: target_workspace.to_path_buf(),
            });
        }
    }

    let staging = tempfile::Builder::new()
        .prefix(".work-shackle-switch-")
        .tempdir_in(target_parent)?;
    validator.validate_existing(staging.path())?;
    let staging_connection =
        prepare_workspace_contents(old_workspace, old_connection, staging.path())?;
    drop(staging_connection);

    if target_workspace.exists() {
        if directory_has_entries(target_workspace)? {
            return Err(WorkspaceSwitchError::TargetNotEmpty {
                path: target_workspace.to_path_buf(),
            });
        }
        fs::remove_dir(target_workspace)?;
    }
    if let Err(error) = fs::rename(staging.path(), target_workspace) {
        if target_existed && !target_workspace.exists() {
            let _ = fs::create_dir(target_workspace);
        }
        return Err(WorkspaceSwitchError::Io(error));
    }

    let connection = match open_connection(target_workspace) {
        Ok(connection) => connection,
        Err(error) => {
            cleanup_prepared_target(target_workspace, target_existed)?;
            return Err(error.into());
        }
    };
    if let Err(error) = verify_database_consistency(old_connection, &connection) {
        drop(connection);
        cleanup_prepared_target(target_workspace, target_existed)?;
        return Err(error);
    }
    Ok(PreparedWorkspace {
        path: target_workspace.to_path_buf(),
        connection,
        target_existed,
    })
}

fn cleanup_prepared_target(path: &Path, restore_empty_directory: bool) -> Result<(), io::Error> {
    if path.exists() {
        fs::remove_dir_all(path)?;
    }
    if restore_empty_directory {
        fs::create_dir(path)?;
    }
    Ok(())
}

fn resolve_path_without_creating(path: &Path) -> Result<PathBuf, io::Error> {
    let absolute = if path.is_absolute() {
        path.to_path_buf()
    } else {
        std::env::current_dir()?.join(path)
    };
    if absolute.exists() {
        return absolute.canonicalize();
    }

    let mut existing = absolute.clone();
    let mut missing_parts = Vec::new();
    while !existing.exists() {
        let part = existing.file_name().ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "workspace path cannot be resolved",
            )
        })?;
        missing_parts.push(part.to_os_string());
        if !existing.pop() {
            return Err(io::Error::new(
                io::ErrorKind::InvalidInput,
                "workspace path has no existing ancestor",
            ));
        }
    }

    let mut resolved = existing.canonicalize()?;
    for part in missing_parts.into_iter().rev() {
        resolved.push(part);
    }
    Ok(resolved)
}

fn prepare_workspace_contents(
    old_workspace: &Path,
    old_connection: &Connection,
    target_workspace: &Path,
) -> Result<Connection, WorkspaceSwitchError> {
    copy_workspace_files(old_workspace, target_workspace)?;
    initialize_workspace_directories(target_workspace, Local::now().date_naive())
        .map_err(|message| WorkspaceSwitchError::Verification(message))?;

    let mut target_connection = open_connection(target_workspace)?;
    {
        let backup = Backup::new(old_connection, &mut target_connection)?;
        backup.run_to_completion(5, Duration::from_millis(10), None)?;
    }
    run_migrations(&mut target_connection)?;
    verify_database_consistency(old_connection, &target_connection)?;

    Ok(target_connection)
}

fn verify_database_consistency(
    old_connection: &Connection,
    new_connection: &Connection,
) -> Result<(), WorkspaceSwitchError> {
    let integrity: String =
        new_connection.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity.to_ascii_lowercase() != "ok" {
        return Err(WorkspaceSwitchError::Verification(format!(
            "integrity_check returned {integrity}"
        )));
    }

    let mut foreign_key_check = new_connection.prepare("PRAGMA foreign_key_check")?;
    if foreign_key_check.query([])?.next()?.is_some() {
        return Err(WorkspaceSwitchError::Verification(
            "foreign_key_check reported violations".to_string(),
        ));
    }

    let old_migrations = migration_versions(old_connection)?;
    let new_migrations = migration_versions(new_connection)?;
    if old_migrations != new_migrations {
        return Err(WorkspaceSwitchError::Verification(
            "schema_migrations differ between workspaces".to_string(),
        ));
    }

    let old_counts = table_counts(old_connection)?;
    let new_counts = table_counts(new_connection)?;
    if old_counts != new_counts {
        return Err(WorkspaceSwitchError::Verification(
            "table sets or row counts differ between workspaces".to_string(),
        ));
    }

    Ok(())
}

fn migration_versions(connection: &Connection) -> Result<Vec<i64>, rusqlite::Error> {
    let mut statement =
        connection.prepare("SELECT version FROM schema_migrations ORDER BY version")?;
    let versions = statement
        .query_map([], |row| row.get(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(versions)
}

fn table_counts(connection: &Connection) -> Result<BTreeMap<String, i64>, WorkspaceSwitchError> {
    let table_names = {
        let mut statement = connection.prepare(
            "SELECT name FROM sqlite_master
             WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
             ORDER BY name",
        )?;
        let names = statement
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        names
    };

    let mut counts = BTreeMap::new();
    for table_name in table_names {
        let quoted_name = table_name.replace('"', "\"\"");
        let count = connection.query_row(
            &format!("SELECT COUNT(*) FROM \"{quoted_name}\""),
            [],
            |row| row.get(0),
        )?;
        counts.insert(table_name, count);
    }
    Ok(counts)
}

fn directory_has_entries(path: &Path) -> Result<bool, io::Error> {
    if !path.is_dir() {
        return Ok(true);
    }
    Ok(fs::read_dir(path)?.next().transpose()?.is_some())
}

fn copy_workspace_files(source: &Path, target: &Path) -> Result<(), io::Error> {
    for entry in fs::read_dir(source)? {
        let entry = entry?;
        copy_workspace_entry(&entry.path(), &target.join(entry.file_name()), false)?;
    }
    Ok(())
}

fn copy_workspace_entry(source: &Path, target: &Path, inside_data: bool) -> Result<(), io::Error> {
    let metadata = fs::symlink_metadata(source)?;
    if metadata.file_type().is_symlink() {
        return Err(io::Error::new(
            io::ErrorKind::Unsupported,
            format!("workspace symlinks are not supported: {}", source.display()),
        ));
    }

    if metadata.is_dir() {
        fs::create_dir(target)?;
        let next_inside_data =
            inside_data || source.file_name().is_some_and(|name| name == ".data");
        for entry in fs::read_dir(source)? {
            let entry = entry?;
            copy_workspace_entry(
                &entry.path(),
                &target.join(entry.file_name()),
                next_inside_data,
            )?;
        }
        return Ok(());
    }

    if !metadata.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::Unsupported,
            format!("unsupported workspace entry: {}", source.display()),
        ));
    }
    if inside_data && is_database_or_sidecar(source) {
        return Ok(());
    }

    let mut input = fs::File::open(source)?;
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(target)?;
    io::copy(&mut input, &mut output)?;
    Ok(())
}

fn is_database_or_sidecar(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|value| value.to_str()) else {
        return false;
    };
    name == DATABASE_FILE_NAME
        || name == format!("{DATABASE_FILE_NAME}-journal")
        || name == format!("{DATABASE_FILE_NAME}-wal")
        || name == format!("{DATABASE_FILE_NAME}-shm")
}

#[cfg(test)]
mod tests {
    use std::fs;
    use std::sync::{mpsc, Arc};
    use std::time::Duration;

    use rusqlite::OptionalExtension;

    use super::*;
    use crate::db::connection::initialize_database;

    fn active_state(workspace: &Path) -> AppState {
        AppState {
            active: Mutex::new(Some(ActiveWorkspace {
                path: workspace.to_path_buf(),
                connection: initialize_database(workspace).expect("initialize active database"),
                startup_warning: None,
                reminder_cutoff_ms: 1,
            })),
        }
    }

    fn save_active_config(config_dir: &Path, workspace: &Path) {
        save_app_config(
            config_dir,
            &AppConfig {
                workspace_path: Some(workspace.to_string_lossy().into_owned()),
            },
        )
        .expect("save active config");
    }

    #[test]
    fn prepares_new_workspace_with_database_and_business_files() {
        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let new_workspace = temp.path().join("new");
        let old_connection = initialize_database(&old_workspace).expect("old database");
        old_connection
            .execute(
                "INSERT INTO tasks (
                    id, title, note, planned_at_ms, priority, status,
                    created_at_ms, updated_at_ms
                 ) VALUES ('task-1', 'Preserved', 'note', 1000, 2, 'not_started', 1000, 1000)",
                [],
            )
            .expect("insert old task");
        let business_file = old_workspace.join("2026/08/report.txt");
        fs::create_dir_all(business_file.parent().expect("business parent"))
            .expect("create business directory");
        fs::write(&business_file, "preserved file").expect("write business file");

        let prepared = prepare_workspace_switch(
            &old_workspace,
            &old_connection,
            &new_workspace,
            &WorkspaceValidator::real(),
        )
        .expect("prepare workspace");

        let task_title: String = prepared
            .connection
            .query_row("SELECT title FROM tasks WHERE id = 'task-1'", [], |row| {
                row.get(0)
            })
            .expect("read copied task");
        assert_eq!(task_title, "Preserved");
        assert_eq!(
            fs::read_to_string(new_workspace.join("2026/08/report.txt")).expect("read copied file"),
            "preserved file"
        );
    }

    #[test]
    fn rejects_nonempty_target_without_changing_its_contents() {
        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let target_workspace = temp.path().join("target");
        let old_connection = initialize_database(&old_workspace).expect("old database");
        fs::create_dir_all(&target_workspace).expect("create target");
        let existing_file = target_workspace.join("existing.txt");
        fs::write(&existing_file, "do not change").expect("write existing target file");

        let result = prepare_workspace_switch(
            &old_workspace,
            &old_connection,
            &target_workspace,
            &WorkspaceValidator::real(),
        );

        assert!(matches!(
            result,
            Err(WorkspaceSwitchError::TargetNotEmpty { .. })
        ));
        assert_eq!(
            fs::read_to_string(existing_file).expect("read existing target file"),
            "do not change"
        );
    }

    #[test]
    fn accepts_existing_empty_target() {
        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let target_workspace = temp.path().join("target");
        let old_connection = initialize_database(&old_workspace).expect("old database");
        fs::create_dir_all(&target_workspace).expect("create empty target");

        let prepared = prepare_workspace_switch(
            &old_workspace,
            &old_connection,
            &target_workspace,
            &WorkspaceValidator::real(),
        )
        .expect("prepare existing empty target");

        assert_eq!(prepared.path, target_workspace);
        assert!(prepared.path.join(".data/work-shackle.db").is_file());
    }

    #[test]
    fn rejects_target_nested_inside_active_workspace_without_creating_it() {
        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let nested_target = old_workspace.join("nested-target");
        let old_connection = initialize_database(&old_workspace).expect("old database");

        let result = prepare_workspace_switch(
            &old_workspace,
            &old_connection,
            &nested_target,
            &WorkspaceValidator::real(),
        );

        assert!(matches!(
            result,
            Err(WorkspaceSwitchError::InvalidTargetRelation { .. })
        ));
        assert!(!nested_target.exists());
    }

    #[cfg(unix)]
    #[test]
    fn copy_failure_leaves_existing_empty_target_untouched() {
        use std::os::unix::fs::symlink;

        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let target_workspace = temp.path().join("target");
        let old_connection = initialize_database(&old_workspace).expect("old database");
        symlink(temp.path(), old_workspace.join("unsupported-link")).expect("create symlink");
        fs::create_dir_all(&target_workspace).expect("create empty target");

        let result = prepare_workspace_switch(
            &old_workspace,
            &old_connection,
            &target_workspace,
            &WorkspaceValidator::real(),
        );

        assert!(result.is_err());
        assert!(target_workspace.is_dir());
        assert_eq!(
            fs::read_dir(&target_workspace)
                .expect("read empty target")
                .count(),
            0
        );
    }

    #[test]
    fn consistency_verification_rejects_different_table_counts() {
        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let new_workspace = temp.path().join("new");
        let old_connection = initialize_database(&old_workspace).expect("old database");
        let new_connection = initialize_database(&new_workspace).expect("new database");
        old_connection
            .execute(
                "INSERT INTO contacts
                 (id, name, is_active, created_at_ms, updated_at_ms)
                 VALUES ('contact-1', 'Only Old', 1, 1, 1)",
                [],
            )
            .expect("insert old contact");

        let result = verify_database_consistency(&old_connection, &new_connection);

        assert!(matches!(result, Err(WorkspaceSwitchError::Verification(_))));
    }

    #[test]
    fn successful_switch_moves_live_reads_and_writes_and_keeps_old_workspace() {
        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let new_workspace = temp.path().join("new");
        let config_dir = temp.path().join("config");
        let state = active_state(&old_workspace);
        state
            .with_db(|connection| {
                connection.execute(
                    "INSERT INTO tasks (
                        id, title, planned_at_ms, priority, status, created_at_ms, updated_at_ms
                     ) VALUES ('old-task', 'Old Task', 1, 2, 'not_started', 1, 1)",
                    [],
                )?;
                Ok(())
            })
            .expect("insert old task");
        save_active_config(&config_dir, &old_workspace);

        state
            .switch_workspace(&config_dir, &new_workspace, &WorkspaceValidator::real())
            .expect("switch workspace");

        state
            .with_db(|connection| {
                let title: String = connection.query_row(
                    "SELECT title FROM tasks WHERE id = 'old-task'",
                    [],
                    |row| row.get(0),
                )?;
                assert_eq!(title, "Old Task");
                connection.execute(
                    "INSERT INTO tasks (
                        id, title, planned_at_ms, priority, status, created_at_ms, updated_at_ms
                     ) VALUES ('new-task', 'New Task', 2, 2, 'not_started', 2, 2)",
                    [],
                )?;
                Ok(())
            })
            .expect("read and write live new database");

        assert_eq!(
            load_app_config(&config_dir)
                .expect("load config")
                .workspace_path,
            Some(new_workspace.to_string_lossy().into_owned())
        );
        assert!(old_workspace.join(".data/work-shackle.db").is_file());
        let old_reopened = initialize_database(&old_workspace).expect("reopen old database");
        let new_task_in_old: Option<String> = old_reopened
            .query_row("SELECT id FROM tasks WHERE id = 'new-task'", [], |row| {
                row.get(0)
            })
            .optional()
            .expect("query old database");
        assert!(new_task_in_old.is_none());
    }

    #[cfg(unix)]
    #[test]
    fn unwritable_target_failure_keeps_old_state_config_and_data() {
        use std::os::unix::fs::PermissionsExt;

        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let target_workspace = temp.path().join("target");
        let config_dir = temp.path().join("config");
        let state = active_state(&old_workspace);
        state
            .with_db(|connection| {
                connection.execute(
                    "INSERT INTO tasks (
                        id, title, planned_at_ms, priority, status, created_at_ms, updated_at_ms
                     ) VALUES ('old-task', 'Old Task', 1, 2, 'not_started', 1, 1)",
                    [],
                )?;
                Ok(())
            })
            .expect("insert old task");
        save_active_config(&config_dir, &old_workspace);
        fs::create_dir_all(&target_workspace).expect("create target");
        fs::set_permissions(&target_workspace, fs::Permissions::from_mode(0o555))
            .expect("make target unwritable");

        let result =
            state.switch_workspace(&config_dir, &target_workspace, &WorkspaceValidator::real());

        fs::set_permissions(&target_workspace, fs::Permissions::from_mode(0o755))
            .expect("restore target permissions");
        assert!(matches!(
            result,
            Err(AppError::ValidationFailed {
                reason: ValidationFailure::NotWritable
            })
        ));
        assert_eq!(
            state
                .active
                .lock()
                .expect("active lock")
                .as_ref()
                .expect("active workspace")
                .path
                .clone(),
            old_workspace
        );
        assert_eq!(
            load_app_config(&config_dir)
                .expect("load config")
                .workspace_path,
            Some(old_workspace.to_string_lossy().into_owned())
        );
        state
            .with_db(|connection| {
                let title: String = connection.query_row(
                    "SELECT title FROM tasks WHERE id = 'old-task'",
                    [],
                    |row| row.get(0),
                )?;
                assert_eq!(title, "Old Task");
                Ok(())
            })
            .expect("old database remains usable");
    }

    #[test]
    fn new_database_verification_failure_keeps_old_state_and_config() {
        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let new_workspace = temp.path().join("new");
        let config_dir = temp.path().join("config");
        let state = active_state(&old_workspace);
        save_active_config(&config_dir, &old_workspace);

        let result = state.switch_workspace_with_operations(
            &config_dir,
            &new_workspace,
            &WorkspaceValidator::real(),
            |_old_path, _old_connection, _target, _validator| {
                Err(WorkspaceSwitchError::Verification(
                    "simulated NEW database validation failure".to_string(),
                ))
            },
            save_app_config,
        );

        assert!(matches!(
            result,
            Err(AppError::WorkspaceSwitchFailed { .. })
        ));
        assert_eq!(
            state
                .active
                .lock()
                .expect("active lock")
                .as_ref()
                .expect("active workspace")
                .path
                .clone(),
            old_workspace
        );
        assert_eq!(
            load_app_config(&config_dir)
                .expect("load config")
                .workspace_path,
            Some(old_workspace.to_string_lossy().into_owned())
        );
        state
            .with_db(|connection| {
                connection.query_row("SELECT 1", [], |row| row.get::<_, i64>(0))?;
                Ok(())
            })
            .expect("old database remains usable");
    }

    #[test]
    fn successful_switch_is_reopened_from_new_workspace_after_restart() {
        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let new_workspace = temp.path().join("new");
        let config_dir = temp.path().join("config");
        let state = active_state(&old_workspace);
        state
            .with_db(|connection| {
                connection.execute(
                    "INSERT INTO tasks (
                        id, title, planned_at_ms, priority, status, created_at_ms, updated_at_ms
                     ) VALUES ('restart-task', 'Restart Task', 1, 2, 'not_started', 1, 1)",
                    [],
                )?;
                Ok(())
            })
            .expect("insert task");
        save_active_config(&config_dir, &old_workspace);
        state
            .switch_workspace(&config_dir, &new_workspace, &WorkspaceValidator::real())
            .expect("switch workspace");
        drop(state);

        let restarted = AppState::new();
        let ready = restarted
            .initialize(
                &config_dir,
                &WorkspaceContext {
                    documents_dir: temp.path().join("documents"),
                    d_drive_root: None,
                    d_drive_writable: false,
                },
                &WorkspaceValidator::real(),
            )
            .expect("restart app");

        assert_eq!(ready.workspace_path, new_workspace.to_string_lossy());
        restarted
            .with_db(|connection| {
                let title: String = connection.query_row(
                    "SELECT title FROM tasks WHERE id = 'restart-task'",
                    [],
                    |row| row.get(0),
                )?;
                assert_eq!(title, "Restart Task");
                Ok(())
            })
            .expect("read task after restart");
    }

    #[test]
    fn config_commit_failure_restores_old_live_connection_and_config() {
        let temp = tempfile::tempdir().expect("tempdir");
        let old_workspace = temp.path().join("old");
        let new_workspace = temp.path().join("new");
        let config_dir = temp.path().join("config");
        let state = active_state(&old_workspace);
        save_active_config(&config_dir, &old_workspace);

        let result = state.switch_workspace_with_operations(
            &config_dir,
            &new_workspace,
            &WorkspaceValidator::real(),
            prepare_workspace_switch,
            |_dir, _config| Err("simulated config failure".to_string()),
        );

        assert!(matches!(result, Err(AppError::ConfigWriteFailed { .. })));
        assert_eq!(
            state
                .active
                .lock()
                .expect("active lock")
                .as_ref()
                .expect("active workspace")
                .path
                .clone(),
            old_workspace
        );
        assert_eq!(
            load_app_config(&config_dir)
                .expect("load config")
                .workspace_path,
            Some(old_workspace.to_string_lossy().into_owned())
        );
        state
            .with_db(|connection| {
                connection.query_row("SELECT 1", [], |row| row.get::<_, i64>(0))?;
                Ok(())
            })
            .expect("old database remains usable");
    }

    #[test]
    fn database_operations_wait_while_workspace_switch_lock_is_held() {
        let temp = tempfile::tempdir().expect("tempdir");
        let state = Arc::new(active_state(&temp.path().join("workspace")));
        let guard = state.active.lock().expect("hold switch lock");
        let (started_tx, started_rx) = mpsc::channel();
        let (finished_tx, finished_rx) = mpsc::channel();
        let writer_state = Arc::clone(&state);

        let writer = std::thread::spawn(move || {
            started_tx.send(()).expect("signal start");
            writer_state
                .with_db(|connection| {
                    connection.execute_batch(
                        "CREATE TABLE lock_probe (id INTEGER);
                         INSERT INTO lock_probe (id) VALUES (1);",
                    )?;
                    Ok(())
                })
                .expect("write after switch lock");
            finished_tx.send(()).expect("signal finish");
        });

        started_rx.recv().expect("writer started");
        assert!(finished_rx.recv_timeout(Duration::from_millis(50)).is_err());
        drop(guard);
        finished_rx
            .recv_timeout(Duration::from_secs(1))
            .expect("writer completed after lock release");
        writer.join().expect("writer thread");
    }

    #[test]
    fn uninitialized_switch_preserves_structured_drive_type_error() {
        let temp = tempfile::tempdir().expect("tempdir");
        let candidate = temp.path().join("network-workspace");
        let state = AppState::new();
        let validator = WorkspaceValidator::with_mount_map(std::collections::HashMap::from([(
            temp.path().to_path_buf(),
            crate::services::workspace_validator::MountKind::Network,
        )]));

        let error = state
            .switch_workspace(&temp.path().join("config"), &candidate, &validator)
            .expect_err("network drive must be rejected");

        assert!(matches!(
            error,
            AppError::WorkspaceNetworkDriveUnsupported { path }
                if path == candidate.to_string_lossy()
        ));
    }

    #[cfg(unix)]
    mod runtime_workspace_missing {
        use super::*;
        use crate::services::busy_rule::{BusyRuleService, SaveBusyLevelInput};
        use crate::services::busy_rule_validation::SaveBusyRulesRequest;
        use crate::services::task::{CreateTaskRequest, TaskService};
        use crate::services::work_status::{SwitchWorkStatusRequest, WorkStatusService};

        fn sample_create_request(title: &str, planned_at_ms: i64) -> CreateTaskRequest {
            CreateTaskRequest {
                title: title.to_string(),
                note: None,
                planned_at_ms,
                deadline_at_ms: None,
                priority: None,
                contact_id: None,
                contact_snapshot: None,
                reminders: vec![],
            }
        }

        fn sample_busy_rules_request() -> SaveBusyRulesRequest {
            SaveBusyRulesRequest {
                levels: vec![
                    SaveBusyLevelInput {
                        min_tasks: 0,
                        max_tasks: Some(1),
                        emoji: "🙂".to_string(),
                        name: "低".to_string(),
                        messages: vec!["低负载".to_string()],
                    },
                    SaveBusyLevelInput {
                        min_tasks: 2,
                        max_tasks: Some(4),
                        emoji: "😵".to_string(),
                        name: "中".to_string(),
                        messages: vec!["中负载".to_string()],
                    },
                    SaveBusyLevelInput {
                        min_tasks: 5,
                        max_tasks: None,
                        emoji: "🤯".to_string(),
                        name: "高".to_string(),
                        messages: vec!["高负载".to_string()],
                    },
                ],
            }
        }

        fn delete_workspace_directory(workspace: &Path) {
            fs::remove_dir_all(workspace).expect("delete workspace directory");
            assert!(!workspace.exists());
        }

        fn assert_workspace_not_found(error: AppError, workspace: &Path) {
            assert!(matches!(error, AppError::WorkspaceNotFound { .. }));
            let serialized = serde_json::to_value(&error).expect("serialize error");
            assert_eq!(
                serialized["code"],
                crate::errors::codes::WORKSPACE_NOT_FOUND
            );
            assert_eq!(
                serialized["details"]["path"],
                workspace.to_string_lossy().as_ref()
            );
        }

        #[test]
        fn runtime_deleted_workspace_blocks_create_task_despite_open_connection() {
            let temp = tempfile::tempdir().expect("tempdir");
            let workspace = temp.path().join("workspace");
            let state = AppState::new();
            state
                .set_active_for_test(&workspace, 1)
                .expect("activate workspace");

            state
                .with_db_app(|connection| {
                    TaskService::create(connection, sample_create_request("Task A", 1_000))
                })
                .expect("seed task a");

            delete_workspace_directory(&workspace);

            let error = state
                .with_db_app(|connection| {
                    TaskService::create(connection, sample_create_request("Task B", 2_000))
                })
                .expect_err("create must fail when workspace directory is missing");

            assert_workspace_not_found(error, &workspace);
            assert!(!workspace.exists());
        }

        #[test]
        fn runtime_deleted_workspace_blocks_complete_task() {
            let temp = tempfile::tempdir().expect("tempdir");
            let workspace = temp.path().join("workspace");
            let state = AppState::new();
            state
                .set_active_for_test(&workspace, 1)
                .expect("activate workspace");

            let created = state
                .with_db_app(|connection| {
                    TaskService::create(connection, sample_create_request("Complete Me", 1_000))
                })
                .expect("seed task");

            delete_workspace_directory(&workspace);

            let error = state
                .with_db_app(|connection| TaskService::complete(connection, &created.id))
                .expect_err("complete must fail when workspace directory is missing");

            assert_workspace_not_found(error, &workspace);
            assert!(!workspace.exists());
        }

        #[test]
        fn runtime_deleted_workspace_blocks_save_busy_rules() {
            let temp = tempfile::tempdir().expect("tempdir");
            let workspace = temp.path().join("workspace");
            let state = AppState::new();
            state
                .set_active_for_test(&workspace, 1)
                .expect("activate workspace");

            delete_workspace_directory(&workspace);

            let error = state
                .with_db_app(|connection| {
                    BusyRuleService::save_busy_rules(connection, sample_busy_rules_request())
                })
                .expect_err("busy rule save must fail when workspace directory is missing");

            assert_workspace_not_found(error, &workspace);
            assert!(!workspace.exists());
        }

        #[test]
        fn runtime_deleted_workspace_blocks_switch_work_status() {
            let temp = tempfile::tempdir().expect("tempdir");
            let workspace = temp.path().join("workspace");
            let state = AppState::new();
            state
                .set_active_for_test(&workspace, 1)
                .expect("activate workspace");

            delete_workspace_directory(&workspace);

            let error = state
                .with_db_app(|connection| {
                    WorkStatusService::switch(
                        connection,
                        SwitchWorkStatusRequest {
                            status_type: "meeting".to_string(),
                        },
                    )
                })
                .expect_err("work status switch must fail when workspace directory is missing");

            assert_workspace_not_found(error, &workspace);
            assert!(!workspace.exists());
        }

        #[test]
        fn runtime_deleted_workspace_blocks_reminder_tick() {
            let temp = tempfile::tempdir().expect("tempdir");
            let workspace = temp.path().join("workspace");
            let state = AppState::new();
            state
                .set_active_for_test(&workspace, 1)
                .expect("activate workspace");

            delete_workspace_directory(&workspace);

            let error = state
                .run_reminder_tick(2_000)
                .expect_err("reminder tick must fail when workspace directory is missing");

            assert_workspace_not_found(error, &workspace);
            assert!(!workspace.exists());
        }

        #[test]
        fn configured_missing_workspace_status_query_is_side_effect_free() {
            let temp = tempfile::tempdir().expect("tempdir");
            let missing = temp.path().join("missing-workspace");
            let config_dir = temp.path().join("config");
            save_active_config(&config_dir, &missing);
            assert!(!missing.exists());

            let ctx = WorkspaceContext {
                documents_dir: temp.path().join("documents"),
                d_drive_root: None,
                d_drive_writable: false,
            };
            let error = crate::services::workspace::build_workspace_status(
                &config_dir,
                &ctx,
                &WorkspaceValidator::real(),
            )
            .expect_err("missing configured workspace status must fail");

            assert_workspace_not_found(error, &missing);
            assert!(!missing.exists());
            assert!(!missing.join(".data").exists());
        }
    }
}
