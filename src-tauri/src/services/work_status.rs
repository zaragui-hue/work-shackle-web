use chrono::Local;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::work_status_repository::{
    CreateStatusCopyInput, CreateWorkStatusRecordInput, StatusCopyRow, WorkStatusRecord,
    WorkStatusRepository, WorkStatusRepositoryError,
};
use crate::errors::AppError;
use crate::time::calendar_day::format_work_date;
use crate::time::work_day;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct FixedWorkStatusDef {
    pub id: &'static str,
    pub emoji: &'static str,
    pub name: &'static str,
    pub sort_order: u8,
    pub selectable: bool,
    pub default_copy: &'static str,
}

pub const FIXED_WORK_STATUSES: &[FixedWorkStatusDef] = &[
    FixedWorkStatusDef {
        id: "working",
        emoji: "🧱",
        name: "工作中",
        sort_order: 1,
        selectable: true,
        default_copy: "键盘已经热起来了，今日份班味加载中。",
    },
    FixedWorkStatusDef {
        id: "focus_brick",
        emoji: "🎧",
        name: "专注搬砖",
        sort_order: 2,
        selectable: true,
        default_copy: "耳机一戴，世界之外只有需求和代码。",
    },
    FixedWorkStatusDef {
        id: "meeting",
        emoji: "💻",
        name: "会议中",
        sort_order: 3,
        selectable: true,
        default_copy: "人还在会议室，灵魂可能已经去午睡了。",
    },
    FixedWorkStatusDef {
        id: "urgent_insert",
        emoji: "🚨",
        name: "临时插单",
        sort_order: 4,
        selectable: true,
        default_copy: "计划永远赶不上突然弹出的那条消息。",
    },
    FixedWorkStatusDef {
        id: "chased_by_requirements",
        emoji: "🏃",
        name: "被需求追杀",
        sort_order: 5,
        selectable: true,
        default_copy: "需求在身后，DDL 在前方，我在中间硬撑。",
    },
    FixedWorkStatusDef {
        id: "slacking",
        emoji: "🐟",
        name: "摸鱼中",
        sort_order: 6,
        selectable: true,
        default_copy: "工作暂停一下，人生加载一会儿。",
    },
    FixedWorkStatusDef {
        id: "gossip",
        emoji: "👂",
        name: "八卦一下",
        sort_order: 7,
        selectable: true,
        default_copy: "耳朵已上线，生产力暂时离线。",
    },
    FixedWorkStatusDef {
        id: "drinking",
        emoji: "☕",
        name: "喝点东西",
        sort_order: 8,
        selectable: true,
        default_copy: "先续一口命，再回去和工位对线。",
    },
    FixedWorkStatusDef {
        id: "lunch",
        emoji: "🍚",
        name: "午餐中",
        sort_order: 9,
        selectable: true,
        default_copy: "干饭是当前唯一高优先级任务。",
    },
    FixedWorkStatusDef {
        id: "nap",
        emoji: "💤",
        name: "午休续命",
        sort_order: 10,
        selectable: true,
        default_copy: "闭眼五分钟，重启一下午。",
    },
    FixedWorkStatusDef {
        id: "daydream",
        emoji: "🫠",
        name: "发会儿呆",
        sort_order: 11,
        selectable: true,
        default_copy: "脑子已下班，身体还在公司。",
    },
    FixedWorkStatusDef {
        id: "preparing_leave",
        emoji: "👜",
        name: "准备下班",
        sort_order: 12,
        selectable: true,
        default_copy: "文件在保存，灵魂已在门口。",
    },
    FixedWorkStatusDef {
        id: "overtime",
        emoji: "🌙",
        name: "加班中",
        sort_order: 13,
        selectable: false,
        default_copy: "夜色已深，工位还在发光。",
    },
];

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FixedWorkStatusDto {
    pub id: String,
    pub emoji: String,
    pub name: String,
    pub sort_order: u8,
    pub selectable: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentWorkStatusDto {
    pub record_id: String,
    pub status_type: String,
    pub emoji: String,
    pub name: String,
    pub display_copy: String,
    pub work_date: String,
    pub start_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatusCopyDto {
    pub id: String,
    pub status_type: String,
    pub content: String,
    pub created_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchWorkStatusRequest {
    pub status_type: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveStatusCopyRequest {
    pub status_type: String,
    pub content: String,
}

pub struct WorkStatusService;

impl WorkStatusService {
    pub fn list_fixed_statuses() -> Vec<FixedWorkStatusDto> {
        FIXED_WORK_STATUSES
            .iter()
            .map(|status| FixedWorkStatusDto {
                id: status.id.to_string(),
                emoji: status.emoji.to_string(),
                name: status.name.to_string(),
                sort_order: status.sort_order,
                selectable: status.selectable,
            })
            .collect()
    }

    pub fn get_current(connection: &Connection) -> Result<Option<CurrentWorkStatusDto>, AppError> {
        Self::ensure_default_copies(connection)?;
        let active = WorkStatusRepository::get_active_record(connection).map_err(map_error)?;
        Ok(active.map(record_to_current_dto))
    }

    pub fn switch(
        connection: &Connection,
        input: SwitchWorkStatusRequest,
    ) -> Result<CurrentWorkStatusDto, AppError> {
        let status_def = resolve_status(&input.status_type)?;
        if !status_def.selectable {
            return Err(AppError::InvalidTaskInput {
                message: format!("status is not user-selectable: {}", input.status_type),
            });
        }

        Self::ensure_default_copies(connection)?;
        let now_ms = now_ms();
        let work_date = format_work_date(work_day::work_date_from_timestamp_ms(now_ms));
        let display_copy = pick_display_copy(connection, status_def.id, now_ms)?;

        let record_id = new_record_id();
        let record = (|| -> Result<WorkStatusRecord, AppError> {
            connection
                .execute("BEGIN IMMEDIATE", [])
                .map_err(|error| AppError::DatabaseError {
                    message: error.to_string(),
                })?;
            let insert_result = (|| -> Result<WorkStatusRecord, AppError> {
                WorkStatusRepository::close_active_records(connection, now_ms)
                    .map_err(map_error)?;
                WorkStatusRepository::insert_record(
                    connection,
                    CreateWorkStatusRecordInput {
                        id: record_id.clone(),
                        work_date: work_date.clone(),
                        status_type: status_def.id.to_string(),
                        display_copy: display_copy.clone(),
                        start_at_ms: now_ms,
                    },
                )
                .map_err(map_error)
            })();

            match insert_result {
                Ok(record) => {
                    connection
                        .execute("COMMIT", [])
                        .map_err(|error| AppError::DatabaseError {
                            message: error.to_string(),
                        })?;
                    Ok(record)
                }
                Err(error) => {
                    let _ = connection.execute("ROLLBACK", []);
                    Err(error)
                }
            }
        })()?;

        Ok(record_to_current_dto(record))
    }

    pub fn open_system_linked_status(
        connection: &Connection,
        status_type: &str,
        now_ms: i64,
    ) -> Result<WorkStatusRecord, AppError> {
        let status_def = resolve_status(status_type)?;
        if status_def.selectable {
            return Err(AppError::InvalidTaskInput {
                message: format!("status is not system-linked: {status_type}"),
            });
        }

        Self::ensure_default_copies(connection)?;
        let work_date = format_work_date(work_day::work_date_from_timestamp_ms(now_ms));
        let display_copy = pick_display_copy(connection, status_def.id, now_ms)?;

        WorkStatusRepository::close_active_records(connection, now_ms).map_err(map_error)?;
        WorkStatusRepository::insert_record(
            connection,
            CreateWorkStatusRecordInput {
                id: new_record_id(),
                work_date,
                status_type: status_def.id.to_string(),
                display_copy,
                start_at_ms: now_ms,
            },
        )
        .map_err(map_error)
    }

    pub fn close_system_linked_status(
        connection: &Connection,
        status_type: &str,
        end_at_ms: i64,
    ) -> Result<(), AppError> {
        resolve_status(status_type)?;
        WorkStatusRepository::close_active_records_for_status(connection, status_type, end_at_ms)
            .map_err(map_error)
    }

    pub fn list_copies(
        connection: &Connection,
        status_type: &str,
    ) -> Result<Vec<StatusCopyDto>, AppError> {
        resolve_status(status_type)?;
        Self::ensure_default_copies(connection)?;
        let rows = WorkStatusRepository::list_copies_for_status(connection, status_type)
            .map_err(map_error)?;
        Ok(rows.into_iter().map(copy_to_dto).collect())
    }

    pub fn save_copy(
        connection: &Connection,
        input: SaveStatusCopyRequest,
    ) -> Result<StatusCopyDto, AppError> {
        resolve_status(&input.status_type)?;
        let content = normalize_copy_content(&input.content)?;
        Self::ensure_default_copies(connection)?;

        let now_ms = now_ms();
        let row = WorkStatusRepository::insert_copy(
            connection,
            CreateStatusCopyInput {
                id: new_copy_id(),
                status_type: input.status_type,
                content,
                created_at_ms: now_ms,
            },
        )
        .map_err(map_error)?;

        Ok(copy_to_dto(row))
    }

    pub fn ensure_default_copies(connection: &Connection) -> Result<(), AppError> {
        for status in FIXED_WORK_STATUSES {
            let count = WorkStatusRepository::count_copies_for_status(connection, status.id)
                .map_err(map_error)?;
            if count > 0 {
                continue;
            }

            WorkStatusRepository::insert_copy(
                connection,
                CreateStatusCopyInput {
                    id: default_copy_id(status.id),
                    status_type: status.id.to_string(),
                    content: status.default_copy.to_string(),
                    created_at_ms: 0,
                },
            )
            .map_err(map_error)?;
        }
        Ok(())
    }
}

pub fn resolve_status(status_type: &str) -> Result<&'static FixedWorkStatusDef, AppError> {
    FIXED_WORK_STATUSES
        .iter()
        .find(|status| status.id == status_type)
        .ok_or_else(|| AppError::InvalidTaskInput {
            message: format!("unsupported work status: {status_type}"),
        })
}

fn record_to_current_dto(record: WorkStatusRecord) -> CurrentWorkStatusDto {
    let status_def = resolve_status(&record.status_type).unwrap_or(&FIXED_WORK_STATUSES[0]);
    CurrentWorkStatusDto {
        record_id: record.id,
        status_type: record.status_type,
        emoji: status_def.emoji.to_string(),
        name: status_def.name.to_string(),
        display_copy: record.display_copy,
        work_date: record.work_date,
        start_at_ms: record.start_at_ms,
    }
}

fn copy_to_dto(row: StatusCopyRow) -> StatusCopyDto {
    StatusCopyDto {
        id: row.id,
        status_type: row.status_type,
        content: row.content,
        created_at_ms: row.created_at_ms,
    }
}

fn pick_display_copy(
    connection: &Connection,
    status_type: &str,
    seed_ms: i64,
) -> Result<String, AppError> {
    let copies =
        WorkStatusRepository::list_copies_for_status(connection, status_type).map_err(map_error)?;
    if copies.is_empty() {
        return Err(AppError::InvalidTaskInput {
            message: format!("no active copies for status: {status_type}"),
        });
    }
    let index = (seed_ms.unsigned_abs() as usize) % copies.len();
    Ok(copies[index].content.clone())
}

fn normalize_copy_content(content: &str) -> Result<String, AppError> {
    let trimmed = content.trim();
    if trimmed.is_empty() {
        return Err(AppError::InvalidTaskInput {
            message: "status copy must not be empty".to_string(),
        });
    }
    Ok(trimmed.to_string())
}

fn default_copy_id(status_type: &str) -> String {
    format!("default-copy-{status_type}")
}

fn new_record_id() -> String {
    format!("work-status-{}", now_ms())
}

fn new_copy_id() -> String {
    format!("status-copy-{}", now_ms())
}

fn now_ms() -> i64 {
    Local::now().timestamp_millis()
}

fn map_error(error: WorkStatusRepositoryError) -> AppError {
    match error {
        WorkStatusRepositoryError::InvalidInput { message } => {
            AppError::InvalidTaskInput { message }
        }
        WorkStatusRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;

    struct TestDatabase {
        _temp: tempfile::TempDir,
        connection: Connection,
    }

    fn open_test_database() -> TestDatabase {
        let temp = tempfile::tempdir().expect("tempdir");
        let connection = initialize_database(temp.path()).expect("initialize database");
        TestDatabase {
            _temp: temp,
            connection,
        }
    }

    #[test]
    fn fixed_status_list_is_complete_and_order_is_stable() {
        let statuses = WorkStatusService::list_fixed_statuses();
        assert_eq!(statuses.len(), 13);
        assert_eq!(statuses.first().expect("first").id, "working");
        assert_eq!(statuses.last().expect("last").id, "overtime");

        for window in statuses.windows(2) {
            assert!(window[0].sort_order < window[1].sort_order);
        }

        let names: Vec<_> = statuses.iter().map(|status| status.name.as_str()).collect();
        assert_eq!(
            names,
            vec![
                "工作中",
                "专注搬砖",
                "会议中",
                "临时插单",
                "被需求追杀",
                "摸鱼中",
                "八卦一下",
                "喝点东西",
                "午餐中",
                "午休续命",
                "发会儿呆",
                "准备下班",
                "加班中",
            ]
        );
    }

    #[test]
    fn cannot_switch_to_unknown_or_system_linked_status() {
        let db = open_test_database();

        let unknown = WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "totally_new".to_string(),
            },
        );
        assert!(matches!(unknown, Err(AppError::InvalidTaskInput { .. })));

        let overtime = WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "overtime".to_string(),
            },
        );
        assert!(matches!(overtime, Err(AppError::InvalidTaskInput { .. })));
    }

    #[test]
    fn switch_current_status_and_read_back() {
        let db = open_test_database();
        let current = WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "meeting".to_string(),
            },
        )
        .expect("switch");

        assert_eq!(current.status_type, "meeting");
        assert_eq!(current.name, "会议中");
        assert!(!current.display_copy.is_empty());

        let loaded = WorkStatusService::get_current(&db.connection)
            .expect("get current")
            .expect("active status");
        assert_eq!(loaded.status_type, "meeting");
        assert_eq!(loaded.record_id, current.record_id);
    }

    #[test]
    fn current_status_survives_database_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();
        let record_id;

        {
            let connection = initialize_database(workspace).expect("initialize");
            let current = WorkStatusService::switch(
                &connection,
                SwitchWorkStatusRequest {
                    status_type: "slacking".to_string(),
                },
            )
            .expect("switch");
            record_id = current.record_id;
        }

        let reopened = initialize_database(workspace).expect("reopen");
        let loaded = WorkStatusService::get_current(&reopened)
            .expect("get current")
            .expect("active status");
        assert_eq!(loaded.record_id, record_id);
        assert_eq!(loaded.status_type, "slacking");
    }

    #[test]
    fn save_one_status_copy() {
        let db = open_test_database();
        WorkStatusService::ensure_default_copies(&db.connection).expect("seed");

        let saved = WorkStatusService::save_copy(
            &db.connection,
            SaveStatusCopyRequest {
                status_type: "slacking".to_string(),
                content: "  正在进行一些与 KPI 关系不大的重要活动。  ".to_string(),
            },
        )
        .expect("save copy");

        assert_eq!(saved.status_type, "slacking");
        assert_eq!(saved.content, "正在进行一些与 KPI 关系不大的重要活动。");
    }

    #[test]
    fn save_multiple_copies_and_read_them_back() {
        let db = open_test_database();
        WorkStatusService::ensure_default_copies(&db.connection).expect("seed");

        WorkStatusService::save_copy(
            &db.connection,
            SaveStatusCopyRequest {
                status_type: "slacking".to_string(),
                content: "文案 A".to_string(),
            },
        )
        .expect("save A");
        WorkStatusService::save_copy(
            &db.connection,
            SaveStatusCopyRequest {
                status_type: "slacking".to_string(),
                content: "文案 B".to_string(),
            },
        )
        .expect("save B");

        let copies = WorkStatusService::list_copies(&db.connection, "slacking").expect("list");
        assert!(copies.len() >= 3);
        assert!(copies.iter().any(|copy| copy.content == "文案 A"));
        assert!(copies.iter().any(|copy| copy.content == "文案 B"));
    }

    #[test]
    fn editing_copies_does_not_change_fixed_status_metadata() {
        let db = open_test_database();
        let before = WorkStatusService::list_fixed_statuses();

        WorkStatusService::save_copy(
            &db.connection,
            SaveStatusCopyRequest {
                status_type: "working".to_string(),
                content: "自定义搬砖文案".to_string(),
            },
        )
        .expect("save copy");

        let after = WorkStatusService::list_fixed_statuses();
        assert_eq!(before, after);
    }

    #[test]
    fn switching_closes_previous_active_record() {
        let db = open_test_database();
        WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "working".to_string(),
            },
        )
        .expect("first switch");

        let second = WorkStatusService::switch(
            &db.connection,
            SwitchWorkStatusRequest {
                status_type: "lunch".to_string(),
            },
        )
        .expect("second switch");

        assert_eq!(second.status_type, "lunch");
        let active_count: i64 = db
            .connection
            .query_row(
                "SELECT COUNT(*) FROM work_status_records WHERE end_at_ms IS NULL",
                [],
                |row| row.get(0),
            )
            .expect("count");
        assert_eq!(active_count, 1);
    }
}
