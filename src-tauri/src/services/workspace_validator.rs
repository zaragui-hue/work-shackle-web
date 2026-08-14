use std::collections::HashMap;
use std::fs::{self, OpenOptions};
use std::io;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ValidationFailure {
    UncPath,
    #[serde(rename = "WORKSPACE_NETWORK_DRIVE_UNSUPPORTED")]
    NetworkMount,
    #[serde(rename = "WORKSPACE_REMOVABLE_DRIVE_UNSUPPORTED")]
    RemovableMount,
    #[serde(rename = "WORKSPACE_DRIVE_TYPE_UNKNOWN")]
    UnknownDrive,
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
            Self::UnknownDrive => write!(f, "drive type is invalid or unknown"),
            Self::CloudSyncDirectory => {
                write!(
                    f,
                    "cloud-sync directories are not supported; choose a local directory"
                )
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
    #[cfg_attr(not(target_os = "windows"), allow(dead_code))]
    Unknown,
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

    pub fn validate_existing_read_only(&self, path: &Path) -> Result<(), ValidationFailure> {
        let normalized = normalize_path(path);
        self.validate_common(&normalized)?;
        ensure_existing_read_only(&normalized)
    }

    pub fn validate_location(&self, path: &Path) -> Result<(), ValidationFailure> {
        let normalized = normalize_path(path);
        self.validate_common(&normalized)
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
            MountKind::Unknown => return Err(ValidationFailure::UnknownDrive),
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
    if let Some(verbatim) = text.strip_prefix(r"\\?\") {
        return verbatim
            .get(..4)
            .is_some_and(|prefix| prefix.eq_ignore_ascii_case("UNC\\"));
    }
    text.starts_with("\\\\") || text.starts_with("//")
}

pub fn is_cloud_sync_path(path: &Path) -> bool {
    let segments = normalized_path_segments(path);

    segments.iter().any(|segment| {
        segment == "dropbox"
            || segment == "google drive"
            || segment == "googledrive"
            || segment == "icloud"
            || is_onedrive_segment(segment)
    }) || segments
        .windows(2)
        .any(|window| window == ["mobile documents", "com~apple~clouddocs"])
}

fn normalized_path_segments(path: &Path) -> Vec<String> {
    let normalized = normalize_path(path);
    normalized
        .to_string_lossy()
        .replace('\\', "/")
        .to_ascii_lowercase()
        .split('/')
        .filter(|segment| !segment.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn is_onedrive_segment(segment: &str) -> bool {
    segment == "onedrive"
        || segment
            .strip_prefix("onedrive - ")
            .is_some_and(|organization| !organization.trim().is_empty())
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

fn ensure_existing_read_only(path: &Path) -> Result<(), ValidationFailure> {
    let metadata = fs::metadata(path).map_err(|_| ValidationFailure::InvalidPath)?;
    if !metadata.is_dir() {
        return Err(ValidationFailure::InvalidPath);
    }
    if metadata.permissions().readonly() {
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

pub(crate) fn is_directory_writable(path: &Path) -> bool {
    probe_directory_writable(path).is_ok()
}

fn probe_directory_writable(path: &Path) -> io::Result<()> {
    const MAX_PROBE_ATTEMPTS: usize = 32;
    probe_directory_writable_with_candidates(
        path,
        (0..MAX_PROBE_ATTEMPTS).map(|_| unique_probe_name()),
    )
}

fn probe_directory_writable_with_candidates<I, S>(path: &Path, candidate_names: I) -> io::Result<()>
where
    I: IntoIterator<Item = S>,
    S: AsRef<Path>,
{
    for candidate_name in candidate_names {
        let probe_path = path.join(candidate_name);
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&probe_path)
        {
            Ok(file) => {
                drop(file);
                return fs::remove_file(&probe_path).map_err(|error| {
                    io::Error::new(
                        error.kind(),
                        format!(
                            "failed to remove writable probe {}: {error}",
                            probe_path.display()
                        ),
                    )
                });
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error),
        }
    }

    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "could not allocate a unique writable probe file",
    ))
}

fn unique_probe_name() -> String {
    static PROBE_SEQUENCE: AtomicU64 = AtomicU64::new(0);

    let timestamp_nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .unwrap_or_default();
    let sequence = PROBE_SEQUENCE.fetch_add(1, Ordering::Relaxed);

    format!(
        ".work-shackle-write-probe-{}-{timestamp_nanos}-{sequence}",
        std::process::id()
    )
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

#[cfg(any(target_os = "windows", test))]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum WindowsRemovalPolicy {
    Stable,
    Removable,
    Unknown,
}

#[cfg(any(target_os = "windows", test))]
fn classify_windows_storage(
    drive_type: u32,
    fixed_removal_policy: WindowsRemovalPolicy,
) -> MountKind {
    const DRIVE_REMOVABLE: u32 = 2;
    const DRIVE_FIXED: u32 = 3;
    const DRIVE_REMOTE: u32 = 4;

    match drive_type {
        DRIVE_FIXED => match fixed_removal_policy {
            WindowsRemovalPolicy::Stable => MountKind::Local,
            WindowsRemovalPolicy::Removable => MountKind::Removable,
            WindowsRemovalPolicy::Unknown => MountKind::Unknown,
        },
        DRIVE_REMOTE => MountKind::Network,
        DRIVE_REMOVABLE => MountKind::Removable,
        _ => MountKind::Unknown,
    }
}

#[cfg(any(target_os = "windows", test))]
fn classify_windows_removal_policy(policy: u32) -> WindowsRemovalPolicy {
    const EXPECT_NO_REMOVAL: u32 = 1;
    const EXPECT_ORDERLY_REMOVAL: u32 = 2;
    const EXPECT_SURPRISE_REMOVAL: u32 = 3;

    match policy {
        EXPECT_NO_REMOVAL => WindowsRemovalPolicy::Stable,
        EXPECT_ORDERLY_REMOVAL | EXPECT_SURPRISE_REMOVAL => WindowsRemovalPolicy::Removable,
        _ => WindowsRemovalPolicy::Unknown,
    }
}

#[cfg(any(target_os = "windows", test))]
fn windows_drive_root(path: &str) -> Option<String> {
    let path = path.strip_prefix(r"\\?\").unwrap_or(path);
    let bytes = path.as_bytes();
    if bytes.len() < 3
        || !bytes[0].is_ascii_alphabetic()
        || bytes[1] != b':'
        || !matches!(bytes[2], b'\\' | b'/')
    {
        return None;
    }

    Some(format!("{}:\\", char::from(bytes[0].to_ascii_uppercase())))
}

#[cfg(target_os = "windows")]
fn detect_mount_kind(path: &Path) -> MountKind {
    use std::iter;
    use std::os::windows::ffi::OsStrExt;

    use windows_sys::Win32::Storage::FileSystem::GetDriveTypeW;

    let Some(root) = windows_drive_root(&path.to_string_lossy()) else {
        return MountKind::Unknown;
    };
    let wide_root: Vec<u16> = std::ffi::OsStr::new(&root)
        .encode_wide()
        .chain(iter::once(0))
        .collect();

    let drive_type = unsafe { GetDriveTypeW(wide_root.as_ptr()) };
    const DRIVE_FIXED: u32 = 3;
    if drive_type != DRIVE_FIXED {
        return classify_windows_storage(drive_type, WindowsRemovalPolicy::Unknown);
    }

    let removal_policy = windows_removal_policy::query(&root)
        .map(classify_windows_removal_policy)
        .unwrap_or(WindowsRemovalPolicy::Unknown);
    classify_windows_storage(drive_type, removal_policy)
}

#[cfg(target_os = "windows")]
mod windows_removal_policy {
    use std::ffi::c_void;
    use std::io;
    use std::mem::{size_of, zeroed};
    use std::ptr::{null, null_mut};

    use windows_sys::Win32::Devices::DeviceAndDriverInstallation::{
        SetupDiDestroyDeviceInfoList, SetupDiEnumDeviceInterfaces, SetupDiGetClassDevsW,
        SetupDiGetDeviceInterfaceDetailW, SetupDiGetDeviceRegistryPropertyW, DIGCF_DEVICEINTERFACE,
        DIGCF_PRESENT, HDEVINFO, SPDRP_REMOVAL_POLICY, SP_DEVICE_INTERFACE_DATA,
        SP_DEVICE_INTERFACE_DETAIL_DATA_W, SP_DEVINFO_DATA,
    };
    use windows_sys::Win32::Foundation::{
        CloseHandle, ERROR_INSUFFICIENT_BUFFER, ERROR_NO_MORE_ITEMS, HANDLE, INVALID_HANDLE_VALUE,
    };
    use windows_sys::Win32::Storage::FileSystem::{
        CreateFileW, FILE_ATTRIBUTE_NORMAL, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    };
    use windows_sys::Win32::System::Ioctl::{
        GUID_DEVINTERFACE_DISK, IOCTL_STORAGE_GET_DEVICE_NUMBER, STORAGE_DEVICE_NUMBER,
    };
    use windows_sys::Win32::System::IO::DeviceIoControl;

    const REG_DWORD: u32 = 4;

    struct DeviceInfoSet(HDEVINFO);

    impl Drop for DeviceInfoSet {
        fn drop(&mut self) {
            unsafe {
                SetupDiDestroyDeviceInfoList(self.0);
            }
        }
    }

    struct DeviceHandle(HANDLE);

    impl Drop for DeviceHandle {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }

    pub fn query(root: &str) -> io::Result<u32> {
        let volume_path = volume_device_path(root)?;
        let volume_number = query_device_number(volume_path.as_ptr())?;
        let device_info_set = unsafe {
            SetupDiGetClassDevsW(
                &GUID_DEVINTERFACE_DISK,
                null(),
                null_mut(),
                DIGCF_PRESENT | DIGCF_DEVICEINTERFACE,
            )
        };
        if device_info_set == INVALID_HANDLE_VALUE as HDEVINFO {
            return Err(io::Error::last_os_error());
        }
        let device_info_set = DeviceInfoSet(device_info_set);

        let mut index = 0;
        loop {
            let mut interface_data = SP_DEVICE_INTERFACE_DATA {
                cbSize: size_of::<SP_DEVICE_INTERFACE_DATA>() as u32,
                ..Default::default()
            };
            let found = unsafe {
                SetupDiEnumDeviceInterfaces(
                    device_info_set.0,
                    null(),
                    &GUID_DEVINTERFACE_DISK,
                    index,
                    &mut interface_data,
                )
            };
            if found == 0 {
                let error = io::Error::last_os_error();
                if error.raw_os_error() == Some(ERROR_NO_MORE_ITEMS as i32) {
                    break;
                }
                return Err(error);
            }
            index += 1;

            let Ok((device_number, device_info)) =
                device_interface_identity(device_info_set.0, &interface_data)
            else {
                continue;
            };
            if device_number.DeviceType == volume_number.DeviceType
                && device_number.DeviceNumber == volume_number.DeviceNumber
            {
                return query_removal_policy(device_info_set.0, &device_info);
            }
        }

        Err(io::Error::new(
            io::ErrorKind::NotFound,
            "could not map workspace volume to a Windows disk device",
        ))
    }

    fn volume_device_path(root: &str) -> io::Result<Vec<u16>> {
        let drive = root
            .get(..2)
            .filter(|value| value.as_bytes().get(1) == Some(&b':'))
            .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "invalid drive root"))?;
        Ok(format!(r"\\.\{drive}")
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect())
    }

    fn query_device_number(path: *const u16) -> io::Result<STORAGE_DEVICE_NUMBER> {
        let handle = unsafe {
            CreateFileW(
                path,
                0,
                FILE_SHARE_READ | FILE_SHARE_WRITE,
                null(),
                OPEN_EXISTING,
                FILE_ATTRIBUTE_NORMAL,
                null_mut(),
            )
        };
        if handle == INVALID_HANDLE_VALUE {
            return Err(io::Error::last_os_error());
        }
        let handle = DeviceHandle(handle);
        let mut number: STORAGE_DEVICE_NUMBER = unsafe { zeroed() };
        let mut returned = 0;
        let success = unsafe {
            DeviceIoControl(
                handle.0,
                IOCTL_STORAGE_GET_DEVICE_NUMBER,
                null(),
                0,
                &mut number as *mut STORAGE_DEVICE_NUMBER as *mut c_void,
                size_of::<STORAGE_DEVICE_NUMBER>() as u32,
                &mut returned,
                null_mut(),
            )
        };
        if success == 0 {
            return Err(io::Error::last_os_error());
        }
        if returned < size_of::<STORAGE_DEVICE_NUMBER>() as u32 {
            return Err(io::Error::new(
                io::ErrorKind::UnexpectedEof,
                "Windows device-number response was truncated",
            ));
        }
        Ok(number)
    }

    fn device_interface_identity(
        device_info_set: HDEVINFO,
        interface_data: &SP_DEVICE_INTERFACE_DATA,
    ) -> io::Result<(STORAGE_DEVICE_NUMBER, SP_DEVINFO_DATA)> {
        let mut required_size = 0;
        unsafe {
            SetupDiGetDeviceInterfaceDetailW(
                device_info_set,
                interface_data,
                null_mut(),
                0,
                &mut required_size,
                null_mut(),
            );
        }
        let error = io::Error::last_os_error();
        if error.raw_os_error() != Some(ERROR_INSUFFICIENT_BUFFER as i32)
            || required_size < size_of::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>() as u32
        {
            return Err(error);
        }

        let word_count = (required_size as usize + size_of::<usize>() - 1) / size_of::<usize>();
        let mut detail_buffer = vec![0_usize; word_count];
        let detail = detail_buffer
            .as_mut_ptr()
            .cast::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>();
        unsafe {
            (*detail).cbSize = size_of::<SP_DEVICE_INTERFACE_DETAIL_DATA_W>() as u32;
        }
        let mut device_info = SP_DEVINFO_DATA {
            cbSize: size_of::<SP_DEVINFO_DATA>() as u32,
            ..Default::default()
        };
        let success = unsafe {
            SetupDiGetDeviceInterfaceDetailW(
                device_info_set,
                interface_data,
                detail,
                required_size,
                null_mut(),
                &mut device_info,
            )
        };
        if success == 0 {
            return Err(io::Error::last_os_error());
        }

        let device_path = unsafe { std::ptr::addr_of!((*detail).DevicePath).cast::<u16>() };
        let device_number = query_device_number(device_path)?;
        Ok((device_number, device_info))
    }

    fn query_removal_policy(
        device_info_set: HDEVINFO,
        device_info: &SP_DEVINFO_DATA,
    ) -> io::Result<u32> {
        let mut property_type = 0;
        let mut policy = 0_u32;
        let mut required_size = 0;
        let success = unsafe {
            SetupDiGetDeviceRegistryPropertyW(
                device_info_set,
                device_info,
                SPDRP_REMOVAL_POLICY,
                &mut property_type,
                &mut policy as *mut u32 as *mut u8,
                size_of::<u32>() as u32,
                &mut required_size,
            )
        };
        if success == 0 {
            return Err(io::Error::last_os_error());
        }
        if property_type != REG_DWORD || required_size != size_of::<u32>() as u32 {
            return Err(io::Error::new(
                io::ErrorKind::InvalidData,
                "Windows removal policy was not a DWORD",
            ));
        }
        Ok(policy)
    }
}

#[cfg(not(any(target_os = "macos", target_os = "windows")))]
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
    fn windows_storage_classification_requires_stable_fixed_device() {
        assert_eq!(
            classify_windows_storage(3, WindowsRemovalPolicy::Stable),
            MountKind::Local
        );
        assert_eq!(
            classify_windows_storage(3, WindowsRemovalPolicy::Removable),
            MountKind::Removable
        );
        assert_eq!(
            classify_windows_storage(3, WindowsRemovalPolicy::Unknown),
            MountKind::Unknown
        );
        assert_eq!(
            classify_windows_storage(4, WindowsRemovalPolicy::Unknown),
            MountKind::Network
        );
        assert_eq!(
            classify_windows_storage(2, WindowsRemovalPolicy::Unknown),
            MountKind::Removable
        );
        for unsupported in [0, 1, 5, 6, 99] {
            assert_eq!(
                classify_windows_storage(unsupported, WindowsRemovalPolicy::Unknown),
                MountKind::Unknown
            );
        }
    }

    #[test]
    fn windows_removal_policy_values_are_fail_closed() {
        assert_eq!(
            classify_windows_removal_policy(1),
            WindowsRemovalPolicy::Stable
        );
        assert_eq!(
            classify_windows_removal_policy(2),
            WindowsRemovalPolicy::Removable
        );
        assert_eq!(
            classify_windows_removal_policy(3),
            WindowsRemovalPolicy::Removable
        );
        for unsupported in [0, 4, 99] {
            assert_eq!(
                classify_windows_removal_policy(unsupported),
                WindowsRemovalPolicy::Unknown
            );
        }
    }

    #[test]
    fn windows_drive_root_parser_handles_mapped_and_verbatim_drive_paths() {
        assert_eq!(
            windows_drive_root(r"Z:\Work Shackle"),
            Some(r"Z:\".to_string())
        );
        assert_eq!(
            windows_drive_root("c:/Users/test/Work Shackle"),
            Some(r"C:\".to_string())
        );
        assert_eq!(
            windows_drive_root(r"\\?\D:\Work Shackle"),
            Some(r"D:\".to_string())
        );
        assert_eq!(windows_drive_root(r"\\server\share\workspace"), None);
        assert_eq!(windows_drive_root("relative/workspace"), None);
    }

    #[test]
    fn windows_unsupported_drive_failures_have_stable_structured_codes() {
        assert_eq!(
            serde_json::to_value(ValidationFailure::NetworkMount).expect("serialize network"),
            "WORKSPACE_NETWORK_DRIVE_UNSUPPORTED"
        );
        assert_eq!(
            serde_json::to_value(ValidationFailure::RemovableMount).expect("serialize removable"),
            "WORKSPACE_REMOVABLE_DRIVE_UNSUPPORTED"
        );
        assert_eq!(
            serde_json::to_value(ValidationFailure::UnknownDrive).expect("serialize unknown"),
            "WORKSPACE_DRIVE_TYPE_UNKNOWN"
        );
    }

    #[test]
    fn rejects_unc_paths() {
        assert!(is_unc_path(Path::new(r"\\server\share\workspace")));
        assert!(is_unc_path(Path::new("//server/share/workspace")));
        assert!(is_unc_path(Path::new(r"\\?\UNC\server\share\workspace")));
        assert!(!is_unc_path(Path::new(r"\\?\C:\Work Shackle")));
    }

    #[test]
    fn accepts_regular_windows_drive_paths() {
        assert!(!is_unc_path(Path::new(r"D:\Work Shackle")));
        assert!(!is_unc_path(Path::new(
            r"C:\Users\test\Documents\Work Shackle"
        )));
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
        assert!(is_cloud_sync_path(Path::new(
            r"C:\Users\alice\OneDrive\Work Shackle"
        )));
        assert!(is_cloud_sync_path(Path::new(
            r"C:\Users\alice\OneDrive - Contoso\Work Shackle"
        )));
        assert!(is_cloud_sync_path(Path::new(
            r"C:\Users\alice\OneDrive - University of Example\Work Shackle"
        )));
    }

    #[test]
    fn accepts_local_custom_directory() {
        assert!(!is_cloud_sync_path(Path::new(
            "/Users/test/Documents/MyJob"
        )));
        assert!(!is_cloud_sync_path(Path::new(r"E:\工作记录")));
        assert!(!is_cloud_sync_path(Path::new(
            r"C:\Projects\onedrive-parser\Work Shackle"
        )));
        assert!(!is_cloud_sync_path(Path::new(
            r"C:\Users\alice\Documents\My OneDrive Notes"
        )));
        assert!(!is_cloud_sync_path(Path::new(r"C:\Work\Work Shackle")));
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
    fn validator_rejects_invalid_or_unknown_drive_type() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("unknown-workspace");
        fs::create_dir_all(&workspace).expect("create workspace");

        let validator = WorkspaceValidator::with_mount_map(HashMap::from([(
            temp.path().to_path_buf(),
            MountKind::Unknown,
        )]));

        let err = validator
            .validate(&workspace)
            .expect_err("unknown drive type should fail");
        assert_eq!(err, ValidationFailure::UnknownDrive);
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
    fn writable_probe_leaves_no_files_behind() {
        let temp = tempfile::tempdir().expect("tempdir");
        let before = fs::read_dir(temp.path())
            .expect("read directory before validation")
            .count();

        WorkspaceValidator::real()
            .validate_existing(temp.path())
            .expect("writable directory");

        let after = fs::read_dir(temp.path())
            .expect("read directory after validation")
            .count();
        assert_eq!(after, before);
    }

    #[test]
    fn writable_probe_preserves_legacy_probe_named_user_file() {
        let temp = tempfile::tempdir().expect("tempdir");
        let user_file = temp.path().join(".work-shackle-write-probe");
        fs::write(&user_file, "user-owned content").expect("write user file");

        WorkspaceValidator::real()
            .validate_existing(temp.path())
            .expect("writable directory");

        assert!(user_file.is_file());
        assert_eq!(
            fs::read_to_string(user_file).expect("read user file"),
            "user-owned content"
        );
    }

    #[test]
    fn writable_probe_retries_name_collision_without_overwriting_existing_file() {
        let temp = tempfile::tempdir().expect("tempdir");
        let collision_name = ".work-shackle-write-probe-collision";
        let retry_name = ".work-shackle-write-probe-retry";
        let collision_file = temp.path().join(collision_name);
        fs::write(&collision_file, "existing content").expect("write collision file");

        probe_directory_writable_with_candidates(temp.path(), [collision_name, retry_name])
            .expect("probe should retry after collision");

        assert_eq!(
            fs::read_to_string(collision_file).expect("read collision file"),
            "existing content"
        );
        assert!(!temp.path().join(retry_name).exists());
    }

    #[test]
    fn validator_rejects_readonly_existing_directory() {
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;

            let temp = tempfile::tempdir().expect("tempdir");
            let workspace = temp.path().join("readonly-existing");
            fs::create_dir_all(&workspace).expect("create workspace");
            let mut permissions = fs::metadata(&workspace).expect("metadata").permissions();
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
        validator
            .validate(&default_like)
            .expect("default-like path");
    }
}
