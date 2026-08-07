mod connection;
mod migrations;

use std::{fmt, path::Path};

use sqlx::SqlitePool;
use tauri::{AppHandle, Manager, Runtime};

use connection::DatabaseConnectionConfig;

pub const DATABASE_FILE_NAME: &str = "time-is-money.sqlite3";

pub struct DatabaseState {
    pool: SqlitePool,
}

impl DatabaseState {
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DatabaseInitializationError {
    AppDataDirectoryUnavailable,
    DirectoryCreationFailed,
    ConnectionFailed,
    MigrationFailed,
    StateRegistrationFailed,
}

impl DatabaseInitializationError {
    pub const fn code(self) -> &'static str {
        match self {
            Self::AppDataDirectoryUnavailable => "database_app_data_directory_unavailable",
            Self::DirectoryCreationFailed => "database_directory_creation_failed",
            Self::ConnectionFailed => "database_connection_failed",
            Self::MigrationFailed => "database_migration_failed",
            Self::StateRegistrationFailed => "database_state_registration_failed",
        }
    }
}

impl fmt::Display for DatabaseInitializationError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.code())
    }
}

impl std::error::Error for DatabaseInitializationError {}

pub async fn initialize<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<DatabaseState, DatabaseInitializationError> {
    let app_data_directory = app
        .path()
        .app_data_dir()
        .map_err(|_| DatabaseInitializationError::AppDataDirectoryUnavailable)?;

    initialize_in_directory(&app_data_directory).await
}

async fn initialize_in_directory(
    app_data_directory: &Path,
) -> Result<DatabaseState, DatabaseInitializationError> {
    std::fs::create_dir_all(app_data_directory)
        .map_err(|_| DatabaseInitializationError::DirectoryCreationFailed)?;

    let database_path = app_data_directory.join(DATABASE_FILE_NAME);
    initialize_with_config(DatabaseConnectionConfig::file(&database_path)).await
}

async fn initialize_with_config(
    config: DatabaseConnectionConfig,
) -> Result<DatabaseState, DatabaseInitializationError> {
    let pool = connection::connect(config).await?;

    if let Err(error) = migrations::run(&pool).await {
        pool.close().await;
        return Err(error);
    }

    Ok(DatabaseState { pool })
}

#[cfg(test)]
mod tests {
    use std::{
        path::{Path, PathBuf},
        sync::atomic::{AtomicU64, Ordering},
        time::{SystemTime, UNIX_EPOCH},
    };

    use super::*;

    static NEXT_TEMP_DIRECTORY_ID: AtomicU64 = AtomicU64::new(0);

    struct TempDirectory {
        path: PathBuf,
    }

    impl TempDirectory {
        fn new() -> Self {
            let timestamp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .expect("system time must be after the Unix epoch")
                .as_nanos();
            let sequence = NEXT_TEMP_DIRECTORY_ID.fetch_add(1, Ordering::Relaxed);
            let path = std::env::temp_dir().join(format!(
                "time-is-money-sqlite-test-{}-{timestamp}-{sequence}",
                std::process::id()
            ));

            Self { path }
        }

        fn path(&self) -> &Path {
            &self.path
        }
    }

    impl Drop for TempDirectory {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.path);
        }
    }

    fn runtime() -> tokio::runtime::Runtime {
        tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("test runtime must be created")
    }

    #[test]
    fn initialization_errors_expose_only_stable_codes() {
        let errors = [
            DatabaseInitializationError::AppDataDirectoryUnavailable,
            DatabaseInitializationError::DirectoryCreationFailed,
            DatabaseInitializationError::ConnectionFailed,
            DatabaseInitializationError::MigrationFailed,
            DatabaseInitializationError::StateRegistrationFailed,
        ];

        for error in errors {
            let message = error.to_string();
            assert_eq!(message, error.code());
            assert!(!message.contains(':'));
            assert!(!message.contains('/') && !message.contains('\\'));
            assert!(!message.to_ascii_lowercase().contains("select"));
        }
    }

    #[test]
    fn initializes_in_memory_database_and_reapplies_migrations() {
        runtime().block_on(async {
            let database = initialize_with_config(DatabaseConnectionConfig::in_memory())
                .await
                .expect("in-memory database must initialize");

            let foreign_keys: i64 = sqlx::query_scalar("PRAGMA foreign_keys")
                .fetch_one(database.pool())
                .await
                .expect("foreign_keys pragma must be readable");
            assert_eq!(foreign_keys, 1);

            migrations::run(database.pool())
                .await
                .expect("embedded migrations must be safe to reapply");

            database.pool().close().await;
        });
    }

    #[test]
    fn creates_file_database_and_reconnects_without_deleting_it() {
        runtime().block_on(async {
            let temp_directory = TempDirectory::new();
            let database_path = temp_directory.path().join(DATABASE_FILE_NAME);

            let database = initialize_in_directory(temp_directory.path())
                .await
                .expect("file database must initialize");
            assert!(database_path.is_file());

            let journal_mode: String = sqlx::query_scalar("PRAGMA journal_mode")
                .fetch_one(database.pool())
                .await
                .expect("journal_mode pragma must be readable");
            assert_eq!(journal_mode.to_ascii_lowercase(), "wal");

            database.pool().close().await;

            let reopened = initialize_in_directory(temp_directory.path())
                .await
                .expect("existing database must reconnect");
            assert!(database_path.is_file());

            let foreign_keys: i64 = sqlx::query_scalar("PRAGMA foreign_keys")
                .fetch_one(reopened.pool())
                .await
                .expect("foreign_keys pragma must remain enabled");
            assert_eq!(foreign_keys, 1);

            reopened.pool().close().await;
        });
    }
}
