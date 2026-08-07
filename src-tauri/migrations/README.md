# Migrations

`sqlx::migrate!("./migrations")`でバイナリへ埋め込むSQLite migrationの配置場所です。

アプリ起動時は、app data directoryの`time-is-money.sqlite3`へ接続した後、Tauri Commandを受け付ける前に未適用migrationを順番に実行します。migrationに失敗した場合、既存DBを削除・再作成せず起動を中止します。

Phase 1時点では接続とmigration runnerだけを導入しているため、domain tableを作るSQL fileはまだありません。#29の所有者・同期方針と#32の最終`SessionResult` contractが確定してから、既存fileを編集せずforward-onlyのSQL fileを追加します。
