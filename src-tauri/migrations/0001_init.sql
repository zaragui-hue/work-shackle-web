CREATE TABLE contacts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    note TEXT,
    planned_at_ms INTEGER NOT NULL,
    deadline_at_ms INTEGER,
    priority INTEGER NOT NULL DEFAULT 2 CHECK (priority BETWEEN 1 AND 5),
    status TEXT NOT NULL CHECK (
        status IN (
            'not_started',
            'in_progress',
            'paused',
            'waiting',
            'completed',
            'cancelled'
        )
    ),
    contact_id TEXT,
    contact_snapshot TEXT,
    created_at_ms INTEGER NOT NULL,
    completed_at_ms INTEGER,
    cancelled_at_ms INTEGER,
    updated_at_ms INTEGER NOT NULL,
    FOREIGN KEY (contact_id) REFERENCES contacts (id) ON DELETE SET NULL
);

CREATE TABLE task_reminders (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    remind_at_ms INTEGER NOT NULL,
    message TEXT,
    enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
    fired_at_ms INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE TABLE task_postponements (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    old_deadline_at_ms INTEGER NOT NULL,
    new_deadline_at_ms INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE TABLE system_reminder_log (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL,
    deadline_snapshot_ms INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('ddl_60', 'ddl_30', 'ddl_10', 'ddl_due')),
    scheduled_at_ms INTEGER NOT NULL,
    fired_at_ms INTEGER,
    FOREIGN KEY (task_id) REFERENCES tasks (id) ON DELETE CASCADE
);

CREATE TABLE work_status_records (
    id TEXT PRIMARY KEY,
    work_date TEXT NOT NULL,
    status_type TEXT NOT NULL,
    display_copy TEXT NOT NULL,
    start_at_ms INTEGER NOT NULL,
    end_at_ms INTEGER
);

CREATE TABLE overtime_records (
    id TEXT PRIMARY KEY,
    work_date TEXT NOT NULL,
    start_at_ms INTEGER NOT NULL,
    end_at_ms INTEGER,
    auto_end_at_ms INTEGER NOT NULL,
    end_type TEXT CHECK (end_type IS NULL OR end_type IN ('manual', 'auto')),
    CHECK (
        (end_at_ms IS NULL AND end_type IS NULL)
        OR (end_at_ms IS NOT NULL AND end_type IS NOT NULL)
    )
);

CREATE TABLE daily_work_overrides (
    work_date TEXT PRIMARY KEY,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL
);

CREATE TABLE settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_work_start TEXT NOT NULL,
    default_work_end TEXT NOT NULL,
    lunch_start TEXT NOT NULL,
    lunch_end TEXT NOT NULL,
    updated_at_ms INTEGER NOT NULL
);

CREATE TABLE status_copies (
    id TEXT PRIMARY KEY,
    status_type TEXT NOT NULL,
    content TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
    created_at_ms INTEGER NOT NULL
);

CREATE TABLE busy_level_configs (
    id TEXT PRIMARY KEY,
    min_tasks INTEGER NOT NULL CHECK (min_tasks >= 0),
    max_tasks INTEGER CHECK (max_tasks IS NULL OR max_tasks >= min_tasks),
    emoji TEXT NOT NULL,
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    sort_order INTEGER NOT NULL
);

CREATE TABLE busy_level_messages (
    id TEXT PRIMARY KEY,
    busy_level_id TEXT NOT NULL,
    content TEXT NOT NULL,
    FOREIGN KEY (busy_level_id) REFERENCES busy_level_configs (id) ON DELETE CASCADE
);

CREATE INDEX idx_tasks_planned_at_ms ON tasks (planned_at_ms);
CREATE INDEX idx_tasks_deadline_at_ms ON tasks (deadline_at_ms);
CREATE INDEX idx_tasks_status ON tasks (status);
CREATE INDEX idx_task_reminders_due
    ON task_reminders (enabled, fired_at_ms, remind_at_ms);
CREATE INDEX idx_system_reminder_log_due
    ON system_reminder_log (fired_at_ms, scheduled_at_ms);
CREATE INDEX idx_work_status_records_work_date
    ON work_status_records (work_date);
CREATE INDEX idx_overtime_records_work_date
    ON overtime_records (work_date);
CREATE UNIQUE INDEX one_active_overtime
    ON overtime_records ((1))
    WHERE end_at_ms IS NULL;
