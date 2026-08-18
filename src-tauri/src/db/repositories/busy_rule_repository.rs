use rusqlite::{params, Connection};

use crate::db::connection::DbError;
use crate::id::new_entity_id;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BusyLevelConfigRow {
    pub id: String,
    pub min_tasks: i32,
    pub max_tasks: Option<i32>,
    pub emoji: String,
    pub name: String,
    pub sort_order: i32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BusyLevelMessageRow {
    pub id: String,
    pub busy_level_id: String,
    pub content: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BusyLevelWriteInput {
    pub min_tasks: i32,
    pub max_tasks: Option<i32>,
    pub emoji: String,
    pub name: String,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct DefaultBusyLevelDef {
    pub min_tasks: i32,
    pub max_tasks: Option<i32>,
    pub emoji: &'static str,
    pub name: &'static str,
    pub message: &'static str,
}

pub const DEFAULT_BUSY_LEVELS: &[DefaultBusyLevelDef] = &[
    DefaultBusyLevelDef {
        min_tasks: 0,
        max_tasks: Some(0),
        emoji: "🫧",
        name: "空闲",
        message: "今天居然没事",
    },
    DefaultBusyLevelDef {
        min_tasks: 1,
        max_tasks: Some(2),
        emoji: "🌿",
        name: "松弛",
        message: "还能摸会儿鱼",
    },
    DefaultBusyLevelDef {
        min_tasks: 3,
        max_tasks: Some(5),
        emoji: "🙂",
        name: "正常",
        message: "正常营业",
    },
    DefaultBusyLevelDef {
        min_tasks: 6,
        max_tasks: Some(8),
        emoji: "😵",
        name: "有点忙",
        message: "班味上来了",
    },
    DefaultBusyLevelDef {
        min_tasks: 9,
        max_tasks: Some(12),
        emoji: "🥵",
        name: "很忙",
        message: "有点干冒烟了",
    },
    DefaultBusyLevelDef {
        min_tasks: 13,
        max_tasks: None,
        emoji: "🤯",
        name: "爆满",
        message: "今天别找我",
    },
];

#[derive(Debug)]
pub enum BusyRuleRepositoryError {
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for BusyRuleRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInput { message } => {
                write!(formatter, "invalid busy rule input: {message}")
            }
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for BusyRuleRepositoryError {}

impl From<DbError> for BusyRuleRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for BusyRuleRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub struct BusyRuleRepository;

impl BusyRuleRepository {
    pub fn ensure_defaults(connection: &Connection) -> Result<(), BusyRuleRepositoryError> {
        let count: i64 =
            connection.query_row("SELECT COUNT(*) FROM busy_level_configs", [], |row| {
                row.get(0)
            })?;
        if count > 0 {
            return Ok(());
        }

        let tx = connection.unchecked_transaction()?;
        for (index, level) in DEFAULT_BUSY_LEVELS.iter().enumerate() {
            let level_id = new_entity_id("busy");
            tx.execute(
                "INSERT INTO busy_level_configs (
                    id, min_tasks, max_tasks, emoji, name, sort_order
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    level_id,
                    level.min_tasks,
                    level.max_tasks,
                    level.emoji,
                    level.name,
                    index as i32,
                ],
            )?;
            let message_id = new_entity_id("busy-msg");
            tx.execute(
                "INSERT INTO busy_level_messages (id, busy_level_id, content)
                 VALUES (?1, ?2, ?3)",
                params![message_id, level_id, level.message],
            )?;
        }
        tx.commit()?;
        Ok(())
    }

    pub fn list_configs(
        connection: &Connection,
    ) -> Result<Vec<BusyLevelConfigRow>, BusyRuleRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT id, min_tasks, max_tasks, emoji, name, sort_order
             FROM busy_level_configs
             ORDER BY sort_order ASC, min_tasks ASC",
        )?;
        let rows = statement.query_map([], |row| {
            Ok(BusyLevelConfigRow {
                id: row.get(0)?,
                min_tasks: row.get(1)?,
                max_tasks: row.get(2)?,
                emoji: row.get(3)?,
                name: row.get(4)?,
                sort_order: row.get(5)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn list_messages_for_level(
        connection: &Connection,
        busy_level_id: &str,
    ) -> Result<Vec<BusyLevelMessageRow>, BusyRuleRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT id, busy_level_id, content
             FROM busy_level_messages
             WHERE busy_level_id = ?1
             ORDER BY rowid ASC",
        )?;
        let rows = statement.query_map([busy_level_id], |row| {
            Ok(BusyLevelMessageRow {
                id: row.get(0)?,
                busy_level_id: row.get(1)?,
                content: row.get(2)?,
            })
        })?;
        rows.collect::<Result<Vec<_>, _>>().map_err(Into::into)
    }

    pub fn replace_all(
        connection: &Connection,
        levels: &[BusyLevelWriteInput],
    ) -> Result<(), BusyRuleRepositoryError> {
        let tx = connection.unchecked_transaction()?;
        tx.execute("DELETE FROM busy_level_configs", [])?;

        for (index, level) in levels.iter().enumerate() {
            let level_id = new_entity_id("busy");
            tx.execute(
                "INSERT INTO busy_level_configs (
                    id, min_tasks, max_tasks, emoji, name, sort_order
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    level_id,
                    level.min_tasks,
                    level.max_tasks,
                    level.emoji,
                    level.name,
                    index as i32,
                ],
            )?;

            for message in &level.messages {
                let message_id = new_entity_id("busy-msg");
                tx.execute(
                    "INSERT INTO busy_level_messages (id, busy_level_id, content)
                     VALUES (?1, ?2, ?3)",
                    params![message_id, level_id, message],
                )?;
            }
        }

        tx.commit()?;
        Ok(())
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
    fn ensure_defaults_seeds_busy_rules_once() {
        let db = open_test_database();
        BusyRuleRepository::ensure_defaults(&db.connection).expect("seed");
        BusyRuleRepository::ensure_defaults(&db.connection).expect("seed again");

        let configs = BusyRuleRepository::list_configs(&db.connection).expect("configs");
        assert_eq!(configs.len(), DEFAULT_BUSY_LEVELS.len());
        assert_eq!(configs[0].emoji, "🫧");
        assert_eq!(configs.last().expect("last").max_tasks, None);

        let messages = BusyRuleRepository::list_messages_for_level(&db.connection, &configs[0].id)
            .expect("messages");
        assert_eq!(messages.len(), 1);
        assert_eq!(messages[0].content, "今天居然没事");
    }

    #[test]
    fn replace_all_is_transactional() {
        let db = open_test_database();
        BusyRuleRepository::ensure_defaults(&db.connection).expect("seed");

        BusyRuleRepository::replace_all(
            &db.connection,
            &[BusyLevelWriteInput {
                min_tasks: 0,
                max_tasks: None,
                emoji: "🙂".to_string(),
                name: "测试".to_string(),
                messages: vec!["一条".to_string()],
            }],
        )
        .expect("replace");

        let configs = BusyRuleRepository::list_configs(&db.connection).expect("configs");
        assert_eq!(configs.len(), 1);
        assert_eq!(configs[0].name, "测试");
    }
}
