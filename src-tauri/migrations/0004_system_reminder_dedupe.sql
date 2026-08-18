CREATE UNIQUE INDEX idx_system_reminder_log_dedupe
    ON system_reminder_log (task_id, kind, deadline_snapshot_ms);
