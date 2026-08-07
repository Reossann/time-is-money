use std::{path::Path, time::Duration};

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions},
    ConnectOptions, SqlitePool,
};

use super::DatabaseInitializationError;

const BUSY_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_FILE_CONNECTIONS: u32 = 5;

pub(super) struct DatabaseConnectionConfig {
    options: SqliteConnectOptions,
    max_connections: u32,
}

impl DatabaseConnectionConfig {
    pub(super) fn file(path: &Path) -> Self {
        let options = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .foreign_keys(true)
            .busy_timeout(BUSY_TIMEOUT)
            .journal_mode(SqliteJournalMode::Wal)
            .disable_statement_logging();

        Self {
            options,
            max_connections: MAX_FILE_CONNECTIONS,
        }
    }

    #[cfg(test)]
    pub(super) fn in_memory() -> Self {
        let options = SqliteConnectOptions::new()
            .in_memory(true)
            .foreign_keys(true)
            .busy_timeout(BUSY_TIMEOUT)
            .disable_statement_logging();

        // Each SQLite in-memory connection owns a separate database. A single
        // pooled connection keeps migrations and test queries on the same DB.
        Self {
            options,
            max_connections: 1,
        }
    }
}

pub(super) async fn connect(
    config: DatabaseConnectionConfig,
) -> Result<SqlitePool, DatabaseInitializationError> {
    SqlitePoolOptions::new()
        .max_connections(config.max_connections)
        .connect_with(config.options)
        .await
        .map_err(|_| DatabaseInitializationError::ConnectionFailed)
}
