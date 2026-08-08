//! Windows 向け Native Messaging Host の manifest 配置と Registry 登録。

use serde::Serialize;
use std::fmt;
use std::fs;
use std::path::{Path, PathBuf};

pub const HOST_EXE_NAME: &str = "native-messaging-host.exe";
pub const MANIFEST_FILENAME: &str = "com.timeismoney.app.json";

const CONFIG_JSON: &str = include_str!("../../native-messaging.config.json");

const CHROME_REGISTRY_KEY: &str =
    r"Software\Google\Chrome\NativeMessagingHosts\com.timeismoney.app";
const CHROMIUM_REGISTRY_KEY: &str = r"Software\Chromium\NativeMessagingHosts\com.timeismoney.app";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct NativeMessagingSetupConfig {
    pub host_name: String,
    pub description: String,
    pub allowed_origins: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum NativeMessagingSetupError {
    InvalidInstallDir { message: String },
    HostBinaryNotFound { path: PathBuf },
    ConfigParseFailed { message: String },
    ManifestWriteFailed { path: PathBuf, message: String },
    RegistryWriteFailed { key: String, message: String },
    RegistryRemoveFailed { key: String, message: String },
    ManifestRemoveFailed { path: PathBuf, message: String },
}

impl fmt::Display for NativeMessagingSetupError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidInstallDir { message } => {
                write!(formatter, "invalid install directory: {message}")
            }
            Self::HostBinaryNotFound { path } => {
                write!(
                    formatter,
                    "native messaging host binary not found at {}",
                    path.display()
                )
            }
            Self::ConfigParseFailed { message } => {
                write!(formatter, "native messaging config parse failed: {message}")
            }
            Self::ManifestWriteFailed { path, message } => {
                write!(
                    formatter,
                    "failed to write manifest {}: {message}",
                    path.display()
                )
            }
            Self::RegistryWriteFailed { key, message } => {
                write!(formatter, "failed to write registry key {key}: {message}")
            }
            Self::RegistryRemoveFailed { key, message } => {
                write!(formatter, "failed to remove registry key {key}: {message}")
            }
            Self::ManifestRemoveFailed { path, message } => {
                write!(
                    formatter,
                    "failed to remove manifest {}: {message}",
                    path.display()
                )
            }
        }
    }
}

impl std::error::Error for NativeMessagingSetupError {}

#[derive(Debug, Serialize, PartialEq, Eq)]
struct HostManifest<'a> {
    name: &'a str,
    description: &'a str,
    path: String,
    #[serde(rename = "type")]
    manifest_type: &'a str,
    allowed_origins: &'a [String],
}

pub fn load_config() -> Result<NativeMessagingSetupConfig, NativeMessagingSetupError> {
    let value: serde_json::Value = serde_json::from_str(CONFIG_JSON).map_err(|error| {
        NativeMessagingSetupError::ConfigParseFailed {
            message: error.to_string(),
        }
    })?;

    let host_name = value
        .get("hostName")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| NativeMessagingSetupError::ConfigParseFailed {
            message: "hostName is required".to_string(),
        })?
        .to_string();

    let description = value
        .get("description")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| NativeMessagingSetupError::ConfigParseFailed {
            message: "description is required".to_string(),
        })?
        .to_string();

    let allowed_origins = value
        .get("allowedOrigins")
        .and_then(serde_json::Value::as_array)
        .ok_or_else(|| NativeMessagingSetupError::ConfigParseFailed {
            message: "allowedOrigins must be an array".to_string(),
        })?
        .iter()
        .map(|origin| {
            origin
                .as_str()
                .ok_or_else(|| NativeMessagingSetupError::ConfigParseFailed {
                    message: "allowedOrigins must contain only strings".to_string(),
                })
        })
        .collect::<Result<Vec<_>, _>>()?
        .into_iter()
        .map(ToOwned::to_owned)
        .collect::<Vec<_>>();

    if allowed_origins.is_empty() {
        return Err(NativeMessagingSetupError::ConfigParseFailed {
            message: "allowedOrigins must not be empty".to_string(),
        });
    }

    Ok(NativeMessagingSetupConfig {
        host_name,
        description,
        allowed_origins,
    })
}

pub fn host_exe_path(install_dir: &Path) -> PathBuf {
    install_dir.join(HOST_EXE_NAME)
}

pub fn manifest_path(install_dir: &Path) -> PathBuf {
    install_dir.join(MANIFEST_FILENAME)
}

pub fn validate_install_dir(install_dir: &Path) -> Result<PathBuf, NativeMessagingSetupError> {
    if install_dir.as_os_str().is_empty() {
        return Err(NativeMessagingSetupError::InvalidInstallDir {
            message: "path is empty".to_string(),
        });
    }

    let install_dir = if install_dir.is_absolute() {
        install_dir.to_path_buf()
    } else {
        std::env::current_dir()
            .map_err(|error| NativeMessagingSetupError::InvalidInstallDir {
                message: format!("could not resolve relative install dir: {error}"),
            })?
            .join(install_dir)
    };

    let normalized = fs::canonicalize(&install_dir).map_err(|error| {
        NativeMessagingSetupError::InvalidInstallDir {
            message: format!("{} ({error})", install_dir.display()),
        }
    })?;

    Ok(normalized)
}

pub fn build_manifest_json(
    config: &NativeMessagingSetupConfig,
    host_exe: &Path,
) -> Result<String, NativeMessagingSetupError> {
    if !host_exe.is_file() {
        return Err(NativeMessagingSetupError::HostBinaryNotFound {
            path: host_exe.to_path_buf(),
        });
    }

    let manifest = HostManifest {
        name: &config.host_name,
        description: &config.description,
        path: format_windows_path(host_exe),
        manifest_type: "stdio",
        allowed_origins: &config.allowed_origins,
    };

    serde_json::to_string_pretty(&manifest).map_err(|error| {
        NativeMessagingSetupError::ManifestWriteFailed {
            path: manifest_path(host_exe.parent().unwrap_or(Path::new("."))),
            message: format!("serialize manifest failed: {error}"),
        }
    })
}

#[cfg(windows)]
pub fn install(install_dir: &Path) -> Result<(), NativeMessagingSetupError> {
    let install_dir = validate_install_dir(install_dir)?;
    let config = load_config()?;
    let host_exe = host_exe_path(&install_dir);
    let manifest_file = manifest_path(&install_dir);
    let manifest_json = build_manifest_json(&config, &host_exe)?;

    write_manifest(&manifest_file, &manifest_json)?;

    let manifest_path_string = format_windows_path(&manifest_file);
    let registry_keys = [CHROME_REGISTRY_KEY, CHROMIUM_REGISTRY_KEY];
    let mut registered_keys: Vec<&str> = Vec::new();

    for key in registry_keys {
        match write_registry(key, &manifest_path_string) {
            Ok(()) => registered_keys.push(key),
            Err(error) => {
                rollback_install(&manifest_file, &registered_keys);
                return Err(error);
            }
        }
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn install(_install_dir: &Path) -> Result<(), NativeMessagingSetupError> {
    Err(NativeMessagingSetupError::InvalidInstallDir {
        message: "native messaging setup is only supported on Windows".to_string(),
    })
}

#[cfg(windows)]
pub fn uninstall(install_dir: &Path) -> Result<(), NativeMessagingSetupError> {
    let install_dir = validate_install_dir(install_dir).or_else(|error| match error {
        NativeMessagingSetupError::InvalidInstallDir { .. }
            if !install_dir.as_os_str().is_empty() =>
        {
            Ok(install_dir.to_path_buf())
        }
        other => Err(other),
    })?;

    let mut errors: Vec<NativeMessagingSetupError> = Vec::new();

    for key in [CHROME_REGISTRY_KEY, CHROMIUM_REGISTRY_KEY] {
        if let Err(error) = remove_registry(key) {
            errors.push(error);
        }
    }

    if let Err(error) = remove_manifest(&manifest_path(&install_dir)) {
        errors.push(error);
    }

    if let Some(first_error) = errors.into_iter().next() {
        return Err(first_error);
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn uninstall(_install_dir: &Path) -> Result<(), NativeMessagingSetupError> {
    Ok(())
}

#[cfg(windows)]
pub fn ensure_registered_from_current_exe() -> Result<(), NativeMessagingSetupError> {
    let current_exe =
        std::env::current_exe().map_err(|error| NativeMessagingSetupError::InvalidInstallDir {
            message: format!("could not resolve current executable: {error}"),
        })?;

    let Some(install_dir) = current_exe.parent() else {
        return Err(NativeMessagingSetupError::InvalidInstallDir {
            message: "current executable has no parent directory".to_string(),
        });
    };

    if !host_exe_path(install_dir).is_file() {
        return Err(NativeMessagingSetupError::HostBinaryNotFound {
            path: host_exe_path(install_dir),
        });
    }

    install(install_dir)
}

#[cfg(not(windows))]
pub fn ensure_registered_from_current_exe() -> Result<(), NativeMessagingSetupError> {
    Ok(())
}

#[cfg(windows)]
pub fn is_registered(install_dir: &Path) -> bool {
    let Ok(install_dir) = validate_install_dir(install_dir) else {
        return false;
    };

    let expected_manifest = format_windows_path(&manifest_path(&install_dir));
    registry_points_to_manifest(CHROME_REGISTRY_KEY, &expected_manifest)
        || registry_points_to_manifest(CHROMIUM_REGISTRY_KEY, &expected_manifest)
}

#[cfg(not(windows))]
pub fn is_registered(_install_dir: &Path) -> bool {
    false
}

fn format_windows_path(path: &Path) -> String {
    let path = path.to_string_lossy().replace('/', "\\");

    path.strip_prefix(r"\\?\").unwrap_or(&path).to_string()
}

fn write_manifest(path: &Path, contents: &str) -> Result<(), NativeMessagingSetupError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| {
            NativeMessagingSetupError::ManifestWriteFailed {
                path: path.to_path_buf(),
                message: format!("create parent directory failed: {error}"),
            }
        })?;
    }

    fs::write(path, contents).map_err(|error| NativeMessagingSetupError::ManifestWriteFailed {
        path: path.to_path_buf(),
        message: error.to_string(),
    })
}

fn remove_manifest(path: &Path) -> Result<(), NativeMessagingSetupError> {
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(NativeMessagingSetupError::ManifestRemoveFailed {
            path: path.to_path_buf(),
            message: error.to_string(),
        }),
    }
}

#[cfg(windows)]
fn write_registry(key: &str, manifest_path: &str) -> Result<(), NativeMessagingSetupError> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    RegKey::predef(HKEY_CURRENT_USER)
        .create_subkey(key)
        .map_err(|error| NativeMessagingSetupError::RegistryWriteFailed {
            key: key.to_string(),
            message: error.to_string(),
        })?
        .0
        .set_value("", &manifest_path)
        .map_err(|error| NativeMessagingSetupError::RegistryWriteFailed {
            key: key.to_string(),
            message: error.to_string(),
        })
}

#[cfg(windows)]
fn remove_registry(key: &str) -> Result<(), NativeMessagingSetupError> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    match RegKey::predef(HKEY_CURRENT_USER).delete_subkey_all(key) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(NativeMessagingSetupError::RegistryRemoveFailed {
            key: key.to_string(),
            message: error.to_string(),
        }),
    }
}

#[cfg(windows)]
fn registry_points_to_manifest(key: &str, expected_manifest: &str) -> bool {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    RegKey::predef(HKEY_CURRENT_USER)
        .open_subkey(key)
        .and_then(|key| key.get_value::<String, _>(""))
        .map(|value| paths_equal(&value, expected_manifest))
        .unwrap_or(false)
}

#[cfg(windows)]
fn rollback_install(manifest_file: &Path, registered_keys: &[&str]) {
    for key in registered_keys {
        let _ = remove_registry(key);
    }

    let _ = remove_manifest(manifest_file);
}

fn paths_equal(left: &str, right: &str) -> bool {
    Path::new(left) == Path::new(right)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_install_dir(prefix: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("clock should be after unix epoch")
            .as_nanos();

        std::env::temp_dir().join(format!("time-is-money-{prefix}-{nanos}"))
    }

    #[test]
    fn loads_embedded_config() {
        let config = load_config().expect("config should load");

        assert_eq!(config.host_name, "com.timeismoney.app");
        assert_eq!(
            config.allowed_origins,
            vec!["chrome-extension://cdoabncafaeaijdgbjioennfmebpgcih/"]
        );
    }

    #[test]
    fn removes_windows_extended_length_path_prefix() {
        assert_eq!(
            format_windows_path(Path::new(
                r"\\?\C:\Program Files\Time Is Money\native-messaging-host.exe"
            )),
            r"C:\Program Files\Time Is Money\native-messaging-host.exe"
        );
    }

    #[test]
    fn builds_manifest_json_with_sanitized_windows_path() {
        let dir = temp_install_dir("manifest");
        fs::create_dir_all(&dir).expect("temp dir should be created");
        let host_exe = dir.join(HOST_EXE_NAME);
        fs::write(&host_exe, b"host").expect("host stub should be written");

        let config = load_config().expect("config should load");
        let manifest_json =
            build_manifest_json(&config, &host_exe).expect("manifest should be built");
        let parsed: serde_json::Value =
            serde_json::from_str(&manifest_json).expect("manifest should be valid json");

        assert_eq!(parsed["name"], "com.timeismoney.app");
        assert_eq!(parsed["type"], "stdio");
        assert!(parsed["path"]
            .as_str()
            .expect("path should exist")
            .ends_with(HOST_EXE_NAME));
        assert!(!parsed["path"]
            .as_str()
            .expect("path should exist")
            .starts_with(r"\\?\"));
        assert_eq!(
            parsed["allowed_origins"]
                .as_array()
                .expect("allowed_origins should be array")
                .len(),
            config.allowed_origins.len()
        );

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_missing_host_binary() {
        let dir = temp_install_dir("missing-host");
        fs::create_dir_all(&dir).expect("temp dir should be created");

        let config = load_config().expect("config should load");
        let error = build_manifest_json(&config, &dir.join(HOST_EXE_NAME))
            .expect_err("missing host should fail");

        assert!(matches!(
            error,
            NativeMessagingSetupError::HostBinaryNotFound { .. }
        ));

        let _ = fs::remove_dir_all(&dir);
    }

    #[cfg(windows)]
    #[test]
    fn install_and_uninstall_round_trip() {
        let dir = temp_install_dir("install-roundtrip");
        fs::create_dir_all(&dir).expect("temp dir should be created");
        let host_exe = dir.join(HOST_EXE_NAME);
        fs::write(&host_exe, b"host").expect("host stub should be written");

        install(&dir).expect("install should succeed");
        assert!(manifest_path(&dir).is_file());
        assert!(is_registered(&dir));

        uninstall(&dir).expect("uninstall should succeed");
        assert!(!manifest_path(&dir).exists());
        assert!(!is_registered(&dir));

        let _ = fs::remove_dir_all(&dir);
    }
}
