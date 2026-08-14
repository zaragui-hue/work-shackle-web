CREATE TABLE work_end_decisions (
    work_date TEXT PRIMARY KEY,
    decision TEXT NOT NULL CHECK (decision IN ('normal_off')),
    display_copy TEXT NOT NULL,
    decided_at_ms INTEGER NOT NULL
);
