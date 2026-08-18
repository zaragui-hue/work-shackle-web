use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::busy_rule_repository::{
    BusyLevelWriteInput, BusyRuleRepository, BusyRuleRepositoryError,
};
use crate::errors::AppError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusyLevelMessageDto {
    pub id: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BusyLevelDto {
    pub id: String,
    pub min_tasks: i32,
    pub max_tasks: Option<i32>,
    pub emoji: String,
    pub name: String,
    pub sort_order: i32,
    pub messages: Vec<BusyLevelMessageDto>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBusyLevelInput {
    pub min_tasks: i32,
    pub max_tasks: Option<i32>,
    pub emoji: String,
    pub name: String,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBusyRulesRequest {
    pub levels: Vec<SaveBusyLevelInput>,
}

pub struct BusyRuleService;

impl BusyRuleService {
    pub fn get_busy_rules(connection: &Connection) -> Result<Vec<BusyLevelDto>, AppError> {
        BusyRuleRepository::ensure_defaults(connection).map_err(map_busy_rule_error)?;
        let configs = BusyRuleRepository::list_configs(connection).map_err(map_busy_rule_error)?;

        let mut levels = Vec::with_capacity(configs.len());
        for config in configs {
            let messages = BusyRuleRepository::list_messages_for_level(connection, &config.id)
                .map_err(map_busy_rule_error)?
                .into_iter()
                .map(|message| BusyLevelMessageDto {
                    id: message.id,
                    content: message.content,
                })
                .collect();

            levels.push(BusyLevelDto {
                id: config.id,
                min_tasks: config.min_tasks,
                max_tasks: config.max_tasks,
                emoji: config.emoji,
                name: config.name,
                sort_order: config.sort_order,
                messages,
            });
        }

        Ok(levels)
    }

    pub fn save_busy_rules(
        connection: &Connection,
        input: SaveBusyRulesRequest,
    ) -> Result<Vec<BusyLevelDto>, AppError> {
        let normalized = normalize_and_validate_basic(&input)?;
        BusyRuleRepository::replace_all(connection, &normalized).map_err(map_busy_rule_error)?;
        Self::get_busy_rules(connection)
    }
}

fn normalize_and_validate_basic(
    input: &SaveBusyRulesRequest,
) -> Result<Vec<BusyLevelWriteInput>, AppError> {
    if input.levels.is_empty() {
        return Err(AppError::InvalidTaskInput {
            message: "至少保留一个忙碌档位".to_string(),
        });
    }

    let mut normalized = Vec::with_capacity(input.levels.len());
    for level in &input.levels {
        let emoji = level.emoji.trim();
        let name = level.name.trim();
        if emoji.is_empty() {
            return Err(AppError::InvalidTaskInput {
                message: "Emoji 不能为空".to_string(),
            });
        }
        if name.is_empty() {
            return Err(AppError::InvalidTaskInput {
                message: "状态名称不能为空".to_string(),
            });
        }
        if level.min_tasks < 0 {
            return Err(AppError::InvalidTaskInput {
                message: "任务数不能为负数".to_string(),
            });
        }
        if let Some(max_tasks) = level.max_tasks {
            if max_tasks < level.min_tasks {
                return Err(AppError::InvalidTaskInput {
                    message: "最大任务数不能小于最小任务数".to_string(),
                });
            }
        }

        let messages: Vec<String> = level
            .messages
            .iter()
            .map(|message| message.trim())
            .filter(|message| !message.is_empty())
            .map(|message| message.to_string())
            .collect();
        if messages.is_empty() {
            return Err(AppError::InvalidTaskInput {
                message: "每个档位至少保留一条文案".to_string(),
            });
        }

        normalized.push(BusyLevelWriteInput {
            min_tasks: level.min_tasks,
            max_tasks: level.max_tasks,
            emoji: emoji.to_string(),
            name: name.to_string(),
            messages,
        });
    }

    Ok(normalized)
}

fn map_busy_rule_error(error: BusyRuleRepositoryError) -> AppError {
    match error {
        BusyRuleRepositoryError::InvalidInput { message } => AppError::InvalidTaskInput { message },
        BusyRuleRepositoryError::Db(db_error) => AppError::DatabaseError {
            message: db_error.to_string(),
        },
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::connection::initialize_database;
    use crate::db::repositories::busy_rule_repository::BusyRuleRepository;

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
    fn get_busy_rules_returns_seeded_defaults() {
        let db = open_test_database();
        let levels = BusyRuleService::get_busy_rules(&db.connection).expect("levels");
        assert_eq!(levels.len(), 6);
        assert_eq!(levels[0].emoji, "🫧");
        assert_eq!(levels.last().expect("last").max_tasks, None);
    }

    #[test]
    fn save_busy_rules_replaces_existing_set() {
        let db = open_test_database();
        BusyRuleRepository::ensure_defaults(&db.connection).expect("seed");

        let saved = BusyRuleService::save_busy_rules(
            &db.connection,
            SaveBusyRulesRequest {
                levels: vec![SaveBusyLevelInput {
                    min_tasks: 0,
                    max_tasks: Some(3),
                    emoji: "🙂".to_string(),
                    name: "自定义".to_string(),
                    messages: vec!["文案一".to_string(), "  ".to_string(), "文案二".to_string()],
                }],
            },
        )
        .expect("save");

        assert_eq!(saved.len(), 1);
        assert_eq!(saved[0].name, "自定义");
        assert_eq!(saved[0].messages.len(), 2);
    }

    #[test]
    fn save_rejects_blank_messages_after_trim() {
        let db = open_test_database();
        let err = BusyRuleService::save_busy_rules(
            &db.connection,
            SaveBusyRulesRequest {
                levels: vec![SaveBusyLevelInput {
                    min_tasks: 0,
                    max_tasks: None,
                    emoji: "🙂".to_string(),
                    name: "测试".to_string(),
                    messages: vec!["   ".to_string()],
                }],
            },
        )
        .expect_err("blank message");

        assert!(matches!(err, AppError::InvalidTaskInput { .. }));
    }
}
