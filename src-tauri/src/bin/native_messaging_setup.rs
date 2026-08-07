#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::path::Path;
use std::process::ExitCode;

use time_is_money::platform::native_messaging_setup::{
    self, is_registered, NativeMessagingSetupError,
};

fn main() -> ExitCode {
    let args: Vec<String> = std::env::args().collect();

    let result = match args.get(1).map(String::as_str) {
        Some("install") => run_install(args.get(2).map(String::as_str)),
        Some("uninstall") => run_uninstall(args.get(2).map(String::as_str)),
        Some("status") => run_status(args.get(2).map(String::as_str)),
        _ => {
            eprintln!(
                "Usage:\n  native-messaging-setup install <install-dir>\n  native-messaging-setup uninstall <install-dir>\n  native-messaging-setup status <install-dir>"
            );
            Err(NativeMessagingSetupError::InvalidInstallDir {
                message: "missing command".to_string(),
            })
        }
    };

    match result {
        Ok(()) => ExitCode::SUCCESS,
        Err(error) => {
            eprintln!("{error}");
            exit_code_for(&error)
        }
    }
}

fn run_install(install_dir: Option<&str>) -> Result<(), NativeMessagingSetupError> {
    let install_dir = resolve_install_dir(install_dir)?;
    native_messaging_setup::install(&install_dir)
}

fn run_uninstall(install_dir: Option<&str>) -> Result<(), NativeMessagingSetupError> {
    let install_dir = resolve_install_dir(install_dir)?;
    native_messaging_setup::uninstall(&install_dir)
}

fn run_status(install_dir: Option<&str>) -> Result<(), NativeMessagingSetupError> {
    let install_dir = resolve_install_dir(install_dir)?;

    if is_registered(&install_dir) {
        println!("registered");
    } else {
        println!("not-registered");
        return Err(NativeMessagingSetupError::InvalidInstallDir {
            message: "native messaging host is not registered".to_string(),
        });
    }

    Ok(())
}

fn resolve_install_dir(
    install_dir: Option<&str>,
) -> Result<std::path::PathBuf, NativeMessagingSetupError> {
    match install_dir {
        Some(path) if !path.trim().is_empty() => Ok(Path::new(path).to_path_buf()),
        _ => std::env::current_exe()
            .ok()
            .and_then(|path| path.parent().map(Path::to_path_buf))
            .ok_or_else(|| NativeMessagingSetupError::InvalidInstallDir {
                message: "install directory is required".to_string(),
            }),
    }
}

fn exit_code_for(error: &NativeMessagingSetupError) -> ExitCode {
    let code = match error {
        NativeMessagingSetupError::HostBinaryNotFound { .. } => 2,
        NativeMessagingSetupError::ManifestWriteFailed { .. }
        | NativeMessagingSetupError::ManifestRemoveFailed { .. } => 3,
        NativeMessagingSetupError::RegistryWriteFailed { .. }
        | NativeMessagingSetupError::RegistryRemoveFailed { .. } => 4,
        NativeMessagingSetupError::ConfigParseFailed { .. } => 5,
        NativeMessagingSetupError::InvalidInstallDir { .. } => 1,
    };

    ExitCode::from(code)
}
