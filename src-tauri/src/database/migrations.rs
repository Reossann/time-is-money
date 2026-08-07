use sqlx::{migrate::Migrator, SqlitePool};

use super::DatabaseInitializationError;

static MIGRATOR: Migrator = sqlx::migrate!("./migrations");

pub(super) async fn run(pool: &SqlitePool) -> Result<(), DatabaseInitializationError> {
    MIGRATOR
        .run(pool)
        .await
        .map_err(|_| DatabaseInitializationError::MigrationFailed)
}
