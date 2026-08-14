//! TASK-0105: automated persistence smoke gate test.
//! Test-only helpers; not part of production task CRUD.

#[cfg(test)]
mod tests {
    use std::path::Path;

    use rusqlite::{params, Connection, OptionalExtension};

    use crate::db::connection::{database_path, initialize_database, DATABASE_FILE_NAME};
    use crate::services::startup::run_startup;
    use crate::services::workspace::{save_app_config, AppConfig, WorkspaceContext};
    use crate::services::workspace_validator::WorkspaceValidator;

    const SMOKE_RECORD_ID: &str = "phase1-persistence-smoke-record";
    const SMOKE_RECORD_TITLE: &str = "TASK-0105 Persistence Smoke Record";
    const SMOKE_RECORD_NOTE: &str = "automated-persistence-smoke-test";

    #[derive(Debug, Clone, PartialEq, Eq)]
    struct SmokeRecord {
        id: String,
        title: String,
        note: Option<String>,
        planned_at_ms: i64,
        created_at_ms: i64,
        updated_at_ms: i64,
    }

    #[test]
    fn persistence_smoke_test_survives_connection_close_and_startup_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path().join("workspace");
        std::fs::create_dir_all(&workspace).expect("create workspace");
        let config_dir = temp.path().join("app-config");
        let ctx = test_context(temp.path());

        let expected_db_path = workspace.join(".data").join(DATABASE_FILE_NAME);
        assert_eq!(database_path(&workspace), expected_db_path);

        let first_connection =
            initialize_database(&workspace).expect("first database initialization");
        assert!(expected_db_path.is_file());
        assert_migration_count(&first_connection, 1);

        let written = write_smoke_record(&first_connection).expect("write");
        assert_eq!(written.id, SMOKE_RECORD_ID);
        assert_eq!(written.title, SMOKE_RECORD_TITLE);
        assert_eq!(written.note.as_deref(), Some(SMOKE_RECORD_NOTE));

        drop(first_connection);

        save_app_config(
            &config_dir,
            &AppConfig {
                workspace_path: Some(path_to_string(&workspace)),
            },
        )
        .expect("save workspace config");

        let (ready, second_connection) =
            run_startup(&config_dir, &ctx, &WorkspaceValidator::real()).expect("second startup");
        assert_eq!(ready.workspace_path, path_to_string(&workspace));
        assert!(expected_db_path.is_file());

        let loaded = read_smoke_record(&second_connection)
            .expect("read smoke record")
            .expect("smoke record must still exist after reopen");
        assert_eq!(loaded, written);

        assert_migration_count(&second_connection, 1);
        let contact_count: i64 = second_connection
            .query_row("SELECT COUNT(*) FROM contacts", [], |row| row.get(0))
            .expect("contact count");
        assert_eq!(contact_count, 0);

        assert!(!config_dir.join(".data").join(DATABASE_FILE_NAME).exists());
        assert!(!database_path(&config_dir).exists());

        eprintln!(
            "persistence smoke test sqlite path: {}",
            expected_db_path.display()
        );
    }

    fn write_smoke_record(connection: &Connection) -> rusqlite::Result<SmokeRecord> {
        connection.execute("DELETE FROM tasks WHERE id = ?1", [SMOKE_RECORD_ID])?;

        let record = SmokeRecord {
            id: SMOKE_RECORD_ID.to_string(),
            title: SMOKE_RECORD_TITLE.to_string(),
            note: Some(SMOKE_RECORD_NOTE.to_string()),
            planned_at_ms: 1_704_000_000_000,
            created_at_ms: 1_704_000_000_000,
            updated_at_ms: 1_704_000_000_000,
        };

        connection.execute(
            "INSERT INTO tasks (
                id, title, note, planned_at_ms, deadline_at_ms, priority, status,
                contact_id, contact_snapshot, created_at_ms, completed_at_ms,
                cancelled_at_ms, updated_at_ms
             ) VALUES (?1, ?2, ?3, ?4, NULL, 2, 'not_started', NULL, NULL, ?5, NULL, NULL, ?6)",
            params![
                record.id,
                record.title,
                record.note,
                record.planned_at_ms,
                record.created_at_ms,
                record.updated_at_ms,
            ],
        )?;

        Ok(record)
    }

    fn read_smoke_record(connection: &Connection) -> rusqlite::Result<Option<SmokeRecord>> {
        connection
            .query_row(
                "SELECT id, title, note, planned_at_ms, created_at_ms, updated_at_ms
                 FROM tasks
                 WHERE id = ?1",
                [SMOKE_RECORD_ID],
                |row| {
                    Ok(SmokeRecord {
                        id: row.get(0)?,
                        title: row.get(1)?,
                        note: row.get(2)?,
                        planned_at_ms: row.get(3)?,
                        created_at_ms: row.get(4)?,
                        updated_at_ms: row.get(5)?,
                    })
                },
            )
            .optional()
    }

    fn test_context(temp_root: &Path) -> WorkspaceContext {
        WorkspaceContext {
            documents_dir: temp_root.join("Documents"),
            d_drive_root: None,
            d_drive_writable: false,
        }
    }

    fn assert_migration_count(connection: &Connection, expected: i64) {
        let count: i64 = connection
            .query_row("SELECT COUNT(*) FROM schema_migrations", [], |row| {
                row.get(0)
            })
            .expect("migration count");
        assert_eq!(count, expected);
    }

    fn path_to_string(path: &Path) -> String {
        path.to_string_lossy().into_owned()
    }
}
