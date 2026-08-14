use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::NaiveDate;
use serde::{Deserialize, Serialize};

use crate::errors::AppError;
use crate::time::week_folder::{week_folder_info_for_date, week_folder_relative_path};

#[cfg(windows)]
use super::workspace_validator::is_directory_writable;
use super::workspace_validator::{ValidationFailure, WorkspaceValidator};

pub const WORKSPACE_FOLDER_NAME: &str = "Work Shackle";
const CONFIG_FILE_NAME: &str = "config.json";

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub workspace_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct WorkspaceContext {
    pub documents_dir: PathBuf,
    pub d_drive_root: Option<PathBuf>,
    pub d_drive_writable: bool,
}

impl WorkspaceContext {
    pub fn from_system() -> Self {
        let documents_dir = system_documents_dir();

        #[cfg(windows)]
        let (d_drive_root, d_drive_writable) = {
            let d_root = PathBuf::from(r"D:\");
            let exists = d_root.exists();
            let writable = exists && is_directory_writable(&d_root);
            (if exists { Some(d_root) } else { None }, writable)
        };

        #[cfg(not(windows))]
        let (d_drive_root, d_drive_writable) = (None, false);

        Self {
            documents_dir,
            d_drive_root,
            d_drive_writable,
        }
    }

    pub fn from_system_read_only() -> Self {
        let documents_dir = system_documents_dir();

        #[cfg(windows)]
        let (d_drive_root, d_drive_writable) = {
            let d_root = PathBuf::from(r"D:\");
            let metadata = fs::metadata(&d_root).ok();
            let writable = metadata
                .as_ref()
                .is_some_and(|value| value.is_dir() && !value.permissions().readonly());
            (metadata.map(|_| d_root), writable)
        };

        #[cfg(not(windows))]
        let (d_drive_root, d_drive_writable) = (None, false);

        Self {
            documents_dir,
            d_drive_root,
            d_drive_writable,
        }
    }
}

fn system_documents_dir() -> PathBuf {
    dirs::document_dir().unwrap_or_else(|| {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Documents")
    })
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceStatus {
    pub configured_path: Option<String>,
    pub resolved_path: String,
    pub source: WorkspaceSource,
    pub is_valid: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub validation_error: Option<ValidationFailure>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceSource {
    Configured,
    Default,
}

pub fn config_file_path(app_config_dir: &Path) -> PathBuf {
    app_config_dir.join(CONFIG_FILE_NAME)
}

pub fn load_app_config(app_config_dir: &Path) -> Result<AppConfig, String> {
    let config_path = config_file_path(app_config_dir);
    if !config_path.exists() {
        return Ok(AppConfig::default());
    }

    let contents = fs::read_to_string(&config_path)
        .map_err(|error| format!("read {}: {error}", config_path.display()))?;
    serde_json::from_str(&contents)
        .map_err(|error| format!("parse {}: {error}", config_path.display()))
}

pub fn save_app_config(app_config_dir: &Path, config: &AppConfig) -> Result<(), String> {
    fs::create_dir_all(app_config_dir)
        .map_err(|error| format!("create config dir {}: {error}", app_config_dir.display()))?;

    let config_path = config_file_path(app_config_dir);
    let contents = serde_json::to_string_pretty(config)
        .map_err(|error| format!("serialize config: {error}"))?;
    let mut temporary = tempfile::NamedTempFile::new_in(app_config_dir)
        .map_err(|error| format!("create temporary config: {error}"))?;
    temporary
        .write_all(contents.as_bytes())
        .map_err(|error| format!("write temporary config: {error}"))?;
    temporary
        .as_file()
        .sync_all()
        .map_err(|error| format!("sync temporary config: {error}"))?;
    temporary
        .persist(&config_path)
        .map_err(|error| format!("replace {}: {}", config_path.display(), error.error))?;
    Ok(())
}

pub fn default_workspace_path(ctx: &WorkspaceContext) -> PathBuf {
    if ctx.d_drive_writable {
        if let Some(d_root) = &ctx.d_drive_root {
            return d_root.join(WORKSPACE_FOLDER_NAME);
        }
    }

    ctx.documents_dir.join(WORKSPACE_FOLDER_NAME)
}

pub fn resolve_workspace_path(
    configured_path: Option<&str>,
    ctx: &WorkspaceContext,
) -> (PathBuf, WorkspaceSource) {
    if let Some(path) = configured_path.filter(|value| !value.trim().is_empty()) {
        return (PathBuf::from(path), WorkspaceSource::Configured);
    }

    (default_workspace_path(ctx), WorkspaceSource::Default)
}

pub fn build_workspace_status(
    app_config_dir: &Path,
    ctx: &WorkspaceContext,
    validator: &WorkspaceValidator,
) -> Result<WorkspaceStatus, AppError> {
    let config = load_app_config(app_config_dir)
        .map_err(|message| AppError::ConfigReadFailed { message })?;
    let (resolved_path, source) = resolve_workspace_path(config.workspace_path.as_deref(), ctx);
    if source == WorkspaceSource::Configured && !resolved_path.exists() {
        return Err(AppError::WorkspaceNotFound {
            path: path_to_string(&resolved_path),
        });
    }
    let validation = validator.validate_existing_read_only(&resolved_path);

    Ok(WorkspaceStatus {
        configured_path: config.workspace_path,
        resolved_path: path_to_string(&resolved_path),
        source,
        is_valid: validation.is_ok(),
        validation_error: validation.err(),
    })
}

pub fn set_workspace_path(
    app_config_dir: &Path,
    candidate_path: &Path,
    validator: &WorkspaceValidator,
) -> Result<PathBuf, ValidationFailure> {
    validator.validate(candidate_path)?;
    let mut config = load_app_config(app_config_dir).map_err(|_| ValidationFailure::InvalidPath)?;
    config.workspace_path = Some(path_to_string(candidate_path));
    save_app_config(app_config_dir, &config).map_err(|_| ValidationFailure::InvalidPath)?;
    Ok(candidate_path.to_path_buf())
}

pub fn initialize_workspace_directories(
    workspace: &Path,
    today: NaiveDate,
) -> Result<InitializedWorkspacePaths, String> {
    let data_dir = initialize_workspace_data_directory(workspace)?;
    let (week_dir, week_folder_name) = initialize_current_week_directory(workspace, today)?;

    Ok(InitializedWorkspacePaths {
        data_dir,
        week_dir,
        week_folder_name,
    })
}

pub fn initialize_workspace_data_directory(workspace: &Path) -> Result<PathBuf, String> {
    let data_dir = workspace.join(".data");
    fs::create_dir_all(&data_dir)
        .map_err(|error| format!("create {}: {error}", data_dir.display()))?;
    Ok(data_dir)
}

pub fn initialize_current_week_directory(
    workspace: &Path,
    today: NaiveDate,
) -> Result<(PathBuf, PathBuf), String> {
    let week_info = week_folder_info_for_date(today);
    let week_folder_name = week_folder_relative_path(&week_info);
    let week_dir = workspace.join(&week_folder_name);
    fs::create_dir_all(&week_dir)
        .map_err(|error| format!("create {}: {error}", week_dir.display()))?;
    Ok((week_dir, week_folder_name))
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct InitializedWorkspacePaths {
    pub data_dir: PathBuf,
    pub week_dir: PathBuf,
    pub week_folder_name: PathBuf,
}

fn path_to_string(path: &Path) -> String {
    path.to_string_lossy().into_owned()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::workspace_validator::MountKind;
    use std::collections::HashMap;

    fn mac_context() -> WorkspaceContext {
        WorkspaceContext {
            documents_dir: PathBuf::from("/Users/test/Documents"),
            d_drive_root: None,
            d_drive_writable: false,
        }
    }

    fn windows_context(d_exists: bool, d_writable: bool) -> WorkspaceContext {
        WorkspaceContext {
            documents_dir: PathBuf::from(r"C:\Users\test\Documents"),
            d_drive_root: if d_exists {
                Some(PathBuf::from("D:"))
            } else {
                None
            },
            d_drive_writable: d_writable,
        }
    }

    #[test]
    fn mac_default_path_uses_documents_work_shackle() {
        let path = default_workspace_path(&mac_context());
        assert_eq!(path, PathBuf::from("/Users/test/Documents/Work Shackle"));
    }

    fn normalize_path(path: &Path) -> String {
        path.to_string_lossy().replace('\\', "/")
    }

    #[test]
    fn windows_default_path_prefers_d_drive_when_writable() {
        let path = default_workspace_path(&windows_context(true, true));
        assert_eq!(normalize_path(&path), "D:/Work Shackle");
    }

    #[test]
    fn windows_default_path_falls_back_to_documents_when_d_missing() {
        let path = default_workspace_path(&windows_context(false, false));
        assert_eq!(
            normalize_path(&path),
            "C:/Users/test/Documents/Work Shackle"
        );
    }

    #[test]
    fn windows_default_path_falls_back_to_documents_when_d_not_writable() {
        let path = default_workspace_path(&windows_context(true, false));
        assert_eq!(
            normalize_path(&path),
            "C:/Users/test/Documents/Work Shackle"
        );
    }

    #[test]
    fn configured_path_takes_priority_over_default() {
        let (path, source) = resolve_workspace_path(Some("/Users/test/MyJob"), &mac_context());
        assert_eq!(path, PathBuf::from("/Users/test/MyJob"));
        assert_eq!(source, WorkspaceSource::Configured);
    }

    #[test]
    fn empty_configured_path_uses_default() {
        let (path, source) = resolve_workspace_path(Some("   "), &mac_context());
        assert_eq!(path, PathBuf::from("/Users/test/Documents/Work Shackle"));
        assert_eq!(source, WorkspaceSource::Default);
    }

    #[test]
    fn configured_workspace_status_is_read_only() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("workspace");
        let config_dir = temp.path().join("config");
        fs::create_dir_all(&workspace).expect("create workspace");
        let sentinel = workspace.join(".work-shackle-write-probe");
        fs::write(&sentinel, "preserve me").expect("write sentinel");
        save_app_config(
            &config_dir,
            &AppConfig {
                workspace_path: Some(path_to_string(&workspace)),
            },
        )
        .expect("save config");

        let status =
            build_workspace_status(&config_dir, &mac_context(), &WorkspaceValidator::real())
                .expect("workspace status");

        assert_eq!(status.source, WorkspaceSource::Configured);
        assert!(status.is_valid);
        assert_eq!(
            fs::read_to_string(&sentinel).expect("sentinel must remain"),
            "preserve me"
        );
        assert!(!workspace.join(".data").exists());
    }

    #[test]
    fn missing_configured_workspace_status_returns_not_found_without_recreating_directory() {
        let temp = tempfile::tempdir().expect("tempdir");
        let missing = temp.path().join("missing-workspace");
        let config_dir = temp.path().join("config");
        save_app_config(
            &config_dir,
            &AppConfig {
                workspace_path: Some(path_to_string(&missing)),
            },
        )
        .expect("save config");

        let error =
            build_workspace_status(&config_dir, &mac_context(), &WorkspaceValidator::real())
                .expect_err("missing configured workspace must fail");
        let serialized = serde_json::to_value(error).expect("serialize error");

        assert_eq!(serialized["code"], "WORKSPACE_NOT_FOUND");
        assert_eq!(
            serialized["details"]["path"],
            missing.to_string_lossy().as_ref()
        );
        assert!(!missing.exists());
    }

    #[test]
    fn set_workspace_path_rejects_invalid_candidate_and_does_not_persist() {
        let temp = tempfile::tempdir().expect("tempdir");
        let config_dir = temp.path().join("config");
        let validator = WorkspaceValidator::with_mount_map(HashMap::from([(
            PathBuf::from("/cloud/sync"),
            MountKind::Local,
        )]));

        let err = set_workspace_path(
            &config_dir,
            Path::new(r"\\server\share\workspace"),
            &validator,
        )
        .expect_err("unc path should fail");

        assert_eq!(err, ValidationFailure::UncPath);
        let config = load_app_config(&config_dir).expect("config load");
        assert!(config.workspace_path.is_none());
    }

    #[test]
    fn set_workspace_path_persists_after_validation() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("workspace");
        let config_dir = temp.path().join("config");
        let validator = WorkspaceValidator::real();

        let saved = set_workspace_path(&config_dir, &workspace, &validator).expect("save");
        assert_eq!(saved, workspace);

        let config = load_app_config(&config_dir).expect("config load");
        assert_eq!(
            config.workspace_path,
            Some(workspace.to_string_lossy().into_owned())
        );
    }

    #[test]
    fn initialize_workspace_directories_is_idempotent() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("workspace");
        let today = NaiveDate::from_ymd_opt(2026, 9, 1).expect("valid date");

        let first = initialize_workspace_directories(&workspace, today).expect("first init");
        let second = initialize_workspace_directories(&workspace, today).expect("second init");

        assert_eq!(first, second);
        assert!(first.data_dir.is_dir());
        assert!(first.week_dir.is_dir());
        assert_eq!(
            first.week_folder_name,
            PathBuf::from("2026/08/第36周_08.31-09.06")
        );
    }

    #[test]
    fn initialize_workspace_creates_data_and_current_week_folder() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("workspace");
        let today = NaiveDate::from_ymd_opt(2026, 8, 5).expect("valid date");

        let paths = initialize_workspace_directories(&workspace, today).expect("init");
        assert!(paths.data_dir.ends_with(".data"));
        assert_eq!(
            paths.week_folder_name,
            PathBuf::from("2026/08/第32周_08.03-08.09")
        );
        assert!(paths.week_dir.exists());
    }
}
