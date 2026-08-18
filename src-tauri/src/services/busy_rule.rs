use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::busy_rule_repository::{BusyRuleRepository, BusyRuleRepositoryError};
use crate::errors::AppError;
use crate::services::busy_rule_validation::{
    normalize_busy_levels, validate_busy_level_set, SaveBusyRulesRequest,
};

pub use crate::services::busy_rule_validation::SaveBusyLevelInput;

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

pub struct BusyRuleService;

impl BusyRuleService {
    pub fn get_busy_rules(connection: &Connection) -> Result<Vec<BusyLevelDto>, AppError> {
        BusyRuleRepository::ensure_defaults(connection).map_err(map_busy_rule_error)?;
        Self::list_busy_rules(connection)
    }

    pub fn save_busy_rules(
        connection: &Connection,
        input: SaveBusyRulesRequest,
    ) -> Result<Vec<BusyLevelDto>, AppError> {
        let normalized = normalize_busy_levels(&input)?;
        validate_busy_level_set(&normalized)?;
        BusyRuleRepository::replace_all(connection, &normalized).map_err(map_busy_rule_error)?;
        Self::list_busy_rules(connection)
    }

    pub fn reset_busy_rules_to_default(
        connection: &Connection,
    ) -> Result<Vec<BusyLevelDto>, AppError> {
        let defaults = BusyRuleRepository::default_write_inputs();
        validate_busy_level_set(&defaults)?;
        BusyRuleRepository::replace_all(connection, &defaults).map_err(map_busy_rule_error)?;
        Self::list_busy_rules(connection)
    }

    fn list_busy_rules(connection: &Connection) -> Result<Vec<BusyLevelDto>, AppError> {
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
    use crate::db::repositories::busy_rule_repository::{BusyRuleRepository, DEFAULT_BUSY_LEVELS};
    use crate::services::busy_rule_validation::resolve_busy_level;

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

    fn valid_custom_request() -> SaveBusyRulesRequest {
        SaveBusyRulesRequest {
            levels: vec![
                SaveBusyLevelInput {
                    min_tasks: 0,
                    max_tasks: Some(1),
                    emoji: "🙂".to_string(),
                    name: "低".to_string(),
                    messages: vec!["低负载".to_string()],
                },
                SaveBusyLevelInput {
                    min_tasks: 2,
                    max_tasks: Some(4),
                    emoji: "😵".to_string(),
                    name: "中".to_string(),
                    messages: vec!["中负载".to_string()],
                },
                SaveBusyLevelInput {
                    min_tasks: 5,
                    max_tasks: None,
                    emoji: "🤯".to_string(),
                    name: "高".to_string(),
                    messages: vec!["高负载".to_string()],
                },
            ],
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

        let saved =
            BusyRuleService::save_busy_rules(&db.connection, valid_custom_request()).expect("save");

        assert_eq!(saved.len(), 3);
        assert_eq!(saved[0].name, "低");
        assert_eq!(saved.last().expect("last").max_tasks, None);
    }

    #[test]
    fn save_rejects_invalid_rules_from_ipc() {
        let db = open_test_database();
        BusyRuleRepository::ensure_defaults(&db.connection).expect("seed");

        let err = BusyRuleService::save_busy_rules(
            &db.connection,
            SaveBusyRulesRequest {
                levels: vec![SaveBusyLevelInput {
                    min_tasks: 1,
                    max_tasks: Some(2),
                    emoji: "🙂".to_string(),
                    name: "错".to_string(),
                    messages: vec!["文案".to_string()],
                }],
            },
        )
        .expect_err("invalid first level");

        assert!(matches!(err, AppError::InvalidTaskInput { .. }));
    }

    #[test]
    fn invalid_save_preserves_previous_rules() {
        let db = open_test_database();
        BusyRuleService::save_busy_rules(&db.connection, valid_custom_request()).expect("save");
        let before = BusyRuleService::get_busy_rules(&db.connection).expect("before");

        let err = BusyRuleService::save_busy_rules(
            &db.connection,
            SaveBusyRulesRequest {
                levels: vec![
                    SaveBusyLevelInput {
                        min_tasks: 0,
                        max_tasks: Some(2),
                        emoji: "🙂".to_string(),
                        name: "前".to_string(),
                        messages: vec!["文案".to_string()],
                    },
                    SaveBusyLevelInput {
                        min_tasks: 4,
                        max_tasks: None,
                        emoji: "🤯".to_string(),
                        name: "后".to_string(),
                        messages: vec!["文案".to_string()],
                    },
                ],
            },
        )
        .expect_err("gap");

        assert!(matches!(err, AppError::InvalidTaskInput { .. }));
        let after = BusyRuleService::get_busy_rules(&db.connection).expect("after");
        assert_eq!(before, after);
    }

    #[test]
    fn reset_busy_rules_restores_defaults() {
        let db = open_test_database();
        BusyRuleService::save_busy_rules(&db.connection, valid_custom_request()).expect("custom");

        let restored = BusyRuleService::reset_busy_rules_to_default(&db.connection).expect("reset");

        assert_eq!(restored.len(), DEFAULT_BUSY_LEVELS.len());
        assert_eq!(restored[0].name, "空闲");
        assert_eq!(restored.last().expect("last").name, "爆满");
        assert_eq!(restored[0].messages[0].content, "今天居然没事");
    }

    #[test]
    fn repeated_reset_is_idempotent() {
        let db = open_test_database();
        BusyRuleService::save_busy_rules(&db.connection, valid_custom_request()).expect("custom");

        let first = BusyRuleService::reset_busy_rules_to_default(&db.connection).expect("reset");
        let second =
            BusyRuleService::reset_busy_rules_to_default(&db.connection).expect("reset again");

        assert_eq!(first.len(), second.len());
        assert_eq!(first[0].name, second[0].name);
        assert_eq!(
            first.last().expect("last").name,
            second.last().expect("last").name
        );
        assert_eq!(first[0].messages[0].content, second[0].messages[0].content);
    }

    #[test]
    fn reset_persists_after_reopen() {
        let temp = tempfile::tempdir().expect("tempdir");
        let workspace = temp.path();

        {
            let connection = initialize_database(workspace).expect("initialize");
            BusyRuleService::save_busy_rules(&connection, valid_custom_request()).expect("custom");
            BusyRuleService::reset_busy_rules_to_default(&connection).expect("reset");
        }

        let reopened = initialize_database(workspace).expect("reopen");
        let levels = BusyRuleService::get_busy_rules(&reopened).expect("levels");
        assert_eq!(levels.len(), DEFAULT_BUSY_LEVELS.len());
        assert_eq!(levels[0].emoji, "🫧");
    }

    #[test]
    fn default_resolver_uses_restored_rules() {
        let db = open_test_database();
        BusyRuleService::reset_busy_rules_to_default(&db.connection).expect("reset");
        let defaults = BusyRuleRepository::default_write_inputs();
        let resolved = resolve_busy_level(13, &defaults).expect("resolved");
        assert_eq!(resolved.name, "爆满");
    }
}
