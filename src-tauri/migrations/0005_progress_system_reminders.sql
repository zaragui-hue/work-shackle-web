ALTER TABLE system_reminder_log RENAME TO system_reminder_log_legacy;

CREATE TABLE system_reminder_log (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    deadline_snapshot_ms INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (
        kind IN (
            'ddl_60', 'ddl_30', 'ddl_10', 'ddl_due',
            'progress_half', 'quarter_remaining', 'one_hour_remaining'
        )
    ),
    scheduled_at_ms INTEGER NOT NULL,
    fired_at_ms INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

INSERT INTO system_reminder_log (
    id, task_id, deadline_snapshot_ms, kind, scheduled_at_ms, fired_at_ms
)
SELECT id, task_id, deadline_snapshot_ms, kind, scheduled_at_ms, fired_at_ms
FROM system_reminder_log_legacy;

DROP TABLE system_reminder_log_legacy;

CREATE UNIQUE INDEX idx_system_reminder_log_dedupe
    ON system_reminder_log (task_id, kind, deadline_snapshot_ms);
