use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ValidationFailure {
    UncPath,
    NetworkMount,
    RemovableMount,
    CloudSyncDirectory,
    NotWritable,
    CannotCreate,
    InvalidPath,
}

impl std::fmt::Display for ValidationFailure {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::UncPath => write!(f, "network or UNC paths are not supported"),
            Self::NetworkMount => write!(f, "network-mounted directories are not supported"),
            Self::RemovableMount => write!(f, "removable volumes are not supported"),
            Self::CloudSyncDirectory => {
                write!(f, "cloud-sync directories are not supported; choose a local directory")
            }
            Self::NotWritable => write!(f, "directory is not writable"),
            Self::CannotCreate => write!(f, "directory cannot be created"),
            Self::InvalidPath => write!(f, "invalid workspace path"),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum MountKind {
    Local,
    Network,
    Removable,
}

pub struct WorkspaceValidator {
    mount_overrides: Option<HashMap<PathBuf, MountKind>>,
}

impl WorkspaceValidator {
    pub fn real() -> Self {
        Self {
            mount_overrides: None,
        }
    }

    pub fn with_mount_map(mount_overrides: HashMap<PathBuf, MountKind>) -> Self {
        Self {
            mount_overrides: Some(mount_overrides),
        }
    }

    pub fn validate(&self, path: &Path) -> Result<(), ValidationFailure> {
        let normalized = normalize_path(path);
        self.validate_common(&normalized)?;
        ensure_exists_and_writable(&normalized)
    }

    pub fn validate_existing(&self, path: &Path) -> Result<(), ValidationFailure> {
        let normalized = normalize_path(path);
        self.validate_common(&normalized)?;
        ensure_existing_and_writable(&normalized)
    }

    fn validate_common(&self, normalized: &Path) -> Result<(), ValidationFailure> {
        if is_unc_path(normalized) {
            return Err(ValidationFailure::UncPath);
        }

        if is_cloud_sync_path(normalized) {
            return Err(ValidationFailure::CloudSyncDirectory);
        }

        match self.mount_kind(normalized) {
            MountKind::Network => return Err(ValidationFailure::NetworkMount),
            MountKind::Removable => return Err(ValidationFailure::RemovableMount),
            MountKind::Local => {}
        }

        Ok(())
    }
}

impl Default for WorkspaceValidator {
    fn default() -> Self {
        Self::real()
    }
}

impl WorkspaceValidator {
    fn mount_kind(&self, path: &Path) -> MountKind {
        if let Some(overrides) = &self.mount_overrides {
            for (root, kind) in overrides {
                if path.starts_with(root) {
                    return *kind;
                }
            }
        }

        detect_mount_kind(path)
    }
}

pub fn is_unc_path(path: &Path) -> bool {
    let text = path.to_string_lossy();
    text.starts_with("\\\\") || text.starts_with("//")
}

pub fn is_cloud_sync_path(path: &Path) -> bool {
    let normalized = normalize_path(path);
    let text = normalized.to_string_lossy().replace('\\', "/").to_ascii_lowercase();

    const MARKERS: &[&str] = &[
        "/library/mobile documents/com~apple~clouddocs",
        "/mobile documents/com~apple~clouddocs",
        "/dropbox/",
        "/onedrive/",
        "/google drive/",
        "/googledrive/",
        "/icloud/",
    ];

    MARKERS.iter().any(|marker| text.contains(marker))
}

fn normalize_path(path: &Path) -> PathBuf {
    let mut normalized = PathBuf::new();
    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            Component::Normal(part) => normalized.push(part),
        }
    }
    normalized
}

fn ensure_existing_and_writable(path: &Path) -> Result<(), ValidationFailure> {
    if !path.exists() {
        return Err(ValidationFailure::InvalidPath);
    }
    if !path.is_dir() {
        return Err(ValidationFailure::InvalidPath);
    }
    if !is_directory_writable(path) {
        return Err(ValidationFailure::NotWritable);
    }
    Ok(())
}

fn ensure_exists_and_writable(path: &Path) -> Result<(), ValidationFailure> {
    if path.exists() {
        return ensure_existing_and_writable(path);
    }

    fs::create_dir_all(path).map_err(|_| ValidationFailure::CannotCreate)?;
    if !is_directory_writable(path) {
        return Err(ValidationFailure::NotWritable);
    }
    Ok(())
}

fn is_directory_writable(path: &Path) -> bool {
    let probe = path.join(".work-shackle-write-probe");
    match fs::File::create(&probe) {
        Ok(_) => {
            let _ = fs::remove_file(probe);
            true
        }
        Err(_) => false,
    }
}

#[cfg(target_os = "macos")]
fn detect_mount_kind(path: &Path) -> MountKind {
    use std::ffi::{CStr, CString};
    use std::mem::MaybeUninit;

    const MNT_REMOVABLE: u32 = 0x0000_0100;

    let mount_point = find_mount_point(path);
    let mount_c = match CString::new(mount_point.to_string_lossy().into_owned()) {
        Ok(value) => value,
        Err(_) => return MountKind::Local,
    };

    unsafe {
        let mut stat: MaybeUninit<libc::statfs> = MaybeUninit::uninit();
        if libc::statfs(mount_c.as_ptr(), stat.as_mut_ptr()) != 0 {
            return MountKind::Local;
        }
        let stat = stat.assume_init();
        if stat.f_flags & MNT_REMOVABLE != 0 {
            return MountKind::Removable;
        }

        let fstype = CStr::from_ptr(stat.f_fstypename.as_ptr())
            .to_string_lossy()
            .to_ascii_lowercase();
        if is_network_fstype(&fstype) {
            return MountKind::Network;
        }

        MountKind::Local
    }
}

#[cfg(target_os = "macos")]
fn is_network_fstype(name: &str) -> bool {
    matches!(
        name,
        "nfs" | "smbfs" | "cifs" | "afpfs" | "webdav" | "ftp" | "mntfs"
    )
}

#[cfg(not(target_os = "macos"))]
fn detect_mount_kind(_path: &Path) -> MountKind {
    MountKind::Local
}

#[cfg(target_os = "macos")]
fn find_mount_point(path: &Path) -> PathBuf {
    let mut current = normalize_path(path);
    loop {
        if current.exists() {
            return current;
        }
        if !current.pop() {
            return normalize_path(path);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unc_paths() {
        assert!(is_unc_path(Path::new(r"\\server\share\workspace")));
        assert!(is_unc_path(Path::new("//server/share/workspace")));
    }

    #[test]
    fn accepts_regular_windows_drive_paths() {
        assert!(!is_unc_path(Path::new(r"D:\Work Shackle")));
        assert!(!is_unc_path(Path::new(r"C:\Users\test\Documents\Work Shackle")));
    }

    #[test]
    fn detects_cloud_sync_directories() {
        assert!(is_cloud_sync_path(Path::new(
            "/Users/test/Library/Mobile Documents/com~apple~CloudDocs/Work"
        )));
        assert!(is_cloud_sync_path(Path::new(
            r"C:\Users\test\Dropbox\Work Shackle"
        )));
        assert!(is_cloud_sync_path(Path::new(
            r"C:\Users\test\OneDrive\Work Shackle"
        )));
        assert!(is_cloud_sync_path(Path::new(
            r"C:\Users\test\Google Drive\Work Shackle"
        )));
    }

    #[test]
    fn accepts_local_custom_directory() {
        assert!(!is_cloud_sync_path(Path::new("/Users/test/Documents/MyJob")));
        assert!(!is_cloud_sync_path(Path::new(
            r"E:\工作记录"
        )));
    }

    #[test]
    fn validator_rejects_unc_path() {
        let validator = WorkspaceValidator::real();
        let err = validator
            .validate(Path::new(r"\\server\share\workspace"))
            .expect_err("unc should fail");
        assert_eq!(err, ValidationFailure::UncPath);
    }

    #[test]
    fn validator_rejects_cloud_sync_directory() {
        let validator = WorkspaceValidator::real();
        let err = validator
            .validate(Path::new(
                "/Users/test/Library/Mobile Documents/com~apple~CloudDocs/Work",
            ))
            .expect_err("cloud sync should fail");
        assert_eq!(err, ValidationFailure::CloudSyncDirectory);
    }

    #[test]
    fn validator_rejects_network_mount_on_macos() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("network-workspace");
        fs::create_dir_all(&workspace).expect("create workspace");

        let validator = WorkspaceValidator::with_mount_map(HashMap::from([(
            temp.path().to_path_buf(),
            MountKind::Network,
        )]));

        let err = validator
            .validate(&workspace)
            .expect_err("network mount should fail");
        assert_eq!(err, ValidationFailure::NetworkMount);
    }

    #[test]
    fn validator_rejects_removable_mount_on_macos() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("usb-workspace");
        fs::create_dir_all(&workspace).expect("create workspace");

        let validator = WorkspaceValidator::with_mount_map(HashMap::from([(
            temp.path().to_path_buf(),
            MountKind::Removable,
        )]));

        let err = validator
            .validate(&workspace)
            .expect_err("removable mount should fail");
        assert_eq!(err, ValidationFailure::RemovableMount);
    }

    #[test]
    fn validator_accepts_local_writable_directory() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("local-workspace");
        let validator = WorkspaceValidator::real();
        validator
            .validate(&workspace)
            .expect("local writable directory should pass");
        assert!(workspace.is_dir());
    }

    #[test]
    fn validator_rejects_readonly_existing_directory() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let temp = tempfile::tempdir().expect("tempdir");
            let workspace = temp.path().join("readonly-existing");
            fs::create_dir_all(&workspace).expect("create workspace");
            let mut permissions = fs::metadata(&workspace)
                .expect("metadata")
                .permissions();
            permissions.set_mode(0o555);
            fs::set_permissions(&workspace, permissions).expect("set permissions");

            let validator = WorkspaceValidator::real();
            let err = validator
                .validate_existing(&workspace)
                .expect_err("readonly existing directory should fail");
            assert_eq!(err, ValidationFailure::NotWritable);
        }
    }

    #[test]
    fn default_and_custom_paths_use_same_validator() {
        let temp = tempfile::tempdir().expect("tempdir");
        let custom = temp.path().join("custom");
        let default_like = temp.path().join("Work Shackle");
        let validator = WorkspaceValidator::real();

        validator.validate(&custom).expect("custom path");
        validator.validate(&default_like).expect("default-like path");
    }
}
