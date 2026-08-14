use rusqlite::{params, Connection, OptionalExtension};

use crate::db::connection::DbError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Contact {
    pub id: String,
    pub name: String,
    pub is_active: bool,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct CreateContactInput {
    pub id: String,
    pub name: String,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug)]
pub enum ContactRepositoryError {
    NotFound { id: String },
    InvalidInput { message: String },
    Db(DbError),
}

impl std::fmt::Display for ContactRepositoryError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound { id } => write!(formatter, "contact not found: {id}"),
            Self::InvalidInput { message } => write!(formatter, "invalid contact input: {message}"),
            Self::Db(error) => write!(formatter, "{error}"),
        }
    }
}

impl std::error::Error for ContactRepositoryError {}

impl From<DbError> for ContactRepositoryError {
    fn from(error: DbError) -> Self {
        Self::Db(error)
    }
}

impl From<rusqlite::Error> for ContactRepositoryError {
    fn from(error: rusqlite::Error) -> Self {
        Self::Db(DbError::Sqlite(error))
    }
}

pub struct ContactRepository;

impl ContactRepository {
    pub fn create(
        connection: &Connection,
        input: CreateContactInput,
    ) -> Result<Contact, ContactRepositoryError> {
        validate_name(&input.name)?;

        connection.execute(
            "INSERT INTO contacts (id, name, is_active, created_at_ms, updated_at_ms)
             VALUES (?1, ?2, 1, ?3, ?4)",
            params![
                input.id,
                input.name.trim(),
                input.created_at_ms,
                input.updated_at_ms,
            ],
        )?;

        Self::get_by_id(connection, &input.id)
    }

    pub fn get_by_id(connection: &Connection, id: &str) -> Result<Contact, ContactRepositoryError> {
        connection
            .query_row(
                "SELECT id, name, is_active, created_at_ms, updated_at_ms
                 FROM contacts
                 WHERE id = ?1",
                [id],
                map_contact_row,
            )
            .optional()?
            .ok_or_else(|| ContactRepositoryError::NotFound { id: id.to_string() })
    }

    pub fn find_by_name(
        connection: &Connection,
        name: &str,
    ) -> Result<Option<Contact>, ContactRepositoryError> {
        let trimmed = name.trim();
        connection
            .query_row(
                "SELECT id, name, is_active, created_at_ms, updated_at_ms
                 FROM contacts
                 WHERE name = ?1
                 ORDER BY updated_at_ms DESC
                 LIMIT 1",
                [trimmed],
                map_contact_row,
            )
            .optional()
            .map_err(Into::into)
    }

    pub fn list_active(connection: &Connection) -> Result<Vec<Contact>, ContactRepositoryError> {
        let mut statement = connection.prepare(
            "SELECT id, name, is_active, created_at_ms, updated_at_ms
             FROM contacts
             WHERE is_active = 1
             ORDER BY updated_at_ms DESC, name ASC",
        )?;
        let contacts = statement
            .query_map([], map_contact_row)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(contacts)
    }

    pub fn touch_recent(
        connection: &Connection,
        id: &str,
        updated_at_ms: i64,
    ) -> Result<Contact, ContactRepositoryError> {
        let updated = connection.execute(
            "UPDATE contacts SET updated_at_ms = ?1 WHERE id = ?2 AND is_active = 1",
            params![updated_at_ms, id],
        )?;
        if updated == 0 {
            return Err(ContactRepositoryError::NotFound { id: id.to_string() });
        }
        Self::get_by_id(connection, id)
    }

    pub fn deactivate(
        connection: &Connection,
        id: &str,
        updated_at_ms: i64,
    ) -> Result<Contact, ContactRepositoryError> {
        let contact = Self::get_by_id(connection, id)?;
        if !contact.is_active {
            return Ok(contact);
        }

        connection.execute(
            "UPDATE contacts SET is_active = 0, updated_at_ms = ?1 WHERE id = ?2",
            params![updated_at_ms, id],
        )?;

        Self::get_by_id(connection, id)
    }

    pub fn reactivate(
        connection: &Connection,
        id: &str,
        updated_at_ms: i64,
    ) -> Result<Contact, ContactRepositoryError> {
        connection.execute(
            "UPDATE contacts SET is_active = 1, updated_at_ms = ?1 WHERE id = ?2",
            params![updated_at_ms, id],
        )?;
        Self::get_by_id(connection, id)
    }
}

fn map_contact_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Contact> {
    Ok(Contact {
        id: row.get(0)?,
        name: row.get(1)?,
        is_active: row.get::<_, i32>(2)? == 1,
        created_at_ms: row.get(3)?,
        updated_at_ms: row.get(4)?,
    })
}

fn validate_name(name: &str) -> Result<(), ContactRepositoryError> {
    if name.trim().is_empty() {
        return Err(ContactRepositoryError::InvalidInput {
            message: "contact name must not be empty".to_string(),
        });
    }
    Ok(())
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
    fn create_and_list_active_contacts_orders_by_recent_use() {
        let db = open_test_database();
        ContactRepository::create(
            &db.connection,
            CreateContactInput {
                id: "c-old".to_string(),
                name: "Old".to_string(),
                created_at_ms: 100,
                updated_at_ms: 100,
            },
        )
        .expect("create old");
        ContactRepository::create(
            &db.connection,
            CreateContactInput {
                id: "c-new".to_string(),
                name: "New".to_string(),
                created_at_ms: 200,
                updated_at_ms: 200,
            },
        )
        .expect("create new");
        ContactRepository::touch_recent(&db.connection, "c-old", 500).expect("touch old");

        let contacts = ContactRepository::list_active(&db.connection).expect("list");
        assert_eq!(contacts.len(), 2);
        assert_eq!(contacts[0].id, "c-old");
        assert_eq!(contacts[1].id, "c-new");
    }

    #[test]
    fn deactivate_hides_contact_from_active_list() {
        let db = open_test_database();
        ContactRepository::create(
            &db.connection,
            CreateContactInput {
                id: "c-1".to_string(),
                name: "小王".to_string(),
                created_at_ms: 1,
                updated_at_ms: 1,
            },
        )
        .expect("create");

        ContactRepository::deactivate(&db.connection, "c-1", 2).expect("deactivate");
        let contacts = ContactRepository::list_active(&db.connection).expect("list");
        assert!(contacts.is_empty());

        let stored = ContactRepository::get_by_id(&db.connection, "c-1").expect("get");
        assert!(!stored.is_active);
    }

    #[test]
    fn find_by_name_returns_latest_match() {
        let db = open_test_database();
        ContactRepository::create(
            &db.connection,
            CreateContactInput {
                id: "c-a".to_string(),
                name: "研发".to_string(),
                created_at_ms: 1,
                updated_at_ms: 1,
            },
        )
        .expect("create");

        let found = ContactRepository::find_by_name(&db.connection, "研发").expect("find");
        assert_eq!(found.expect("some").id, "c-a");
    }
}
