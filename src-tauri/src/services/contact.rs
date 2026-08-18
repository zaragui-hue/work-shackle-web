use crate::id::new_entity_id;
use rusqlite::Connection;
use serde::{Deserialize, Serialize};

use crate::db::repositories::contact_repository::{
    Contact, ContactRepository, ContactRepositoryError, CreateContactInput,
};
use crate::errors::AppError;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactDto {
    pub id: String,
    pub name: String,
    pub is_active: bool,
    pub created_at_ms: i64,
    pub updated_at_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateContactRequest {
    pub name: String,
}

pub struct ResolvedTaskContact {
    pub contact_id: Option<String>,
    pub contact_snapshot: Option<String>,
}

pub struct ContactService;

impl ContactService {
    pub fn list_active(connection: &Connection) -> Result<Vec<ContactDto>, AppError> {
        let contacts = ContactRepository::list_active(connection).map_err(map_contact_error)?;
        Ok(contacts.into_iter().map(contact_to_dto).collect())
    }

    pub fn create(
        connection: &Connection,
        input: CreateContactRequest,
    ) -> Result<ContactDto, AppError> {
        let now_ms = now_ms();
        let name = input.name.trim().to_string();
        if name.is_empty() {
            return Err(AppError::InvalidTaskInput {
                message: "contact name must not be empty".to_string(),
            });
        }

        if let Some(existing) =
            ContactRepository::find_by_name(connection, &name).map_err(map_contact_error)?
        {
            let contact = if existing.is_active {
                ContactRepository::touch_recent(connection, &existing.id, now_ms)
            } else {
                ContactRepository::reactivate(connection, &existing.id, now_ms)
            }
            .map_err(map_contact_error)?;
            return Ok(contact_to_dto(contact));
        }

        let contact = ContactRepository::create(
            connection,
            CreateContactInput {
                id: new_entity_id("contact"),
                name,
                created_at_ms: now_ms,
                updated_at_ms: now_ms,
            },
        )
        .map_err(map_contact_error)?;

        Ok(contact_to_dto(contact))
    }

    pub fn deactivate(connection: &Connection, id: &str) -> Result<ContactDto, AppError> {
        let contact =
            ContactRepository::deactivate(connection, id, now_ms()).map_err(map_contact_error)?;
        Ok(contact_to_dto(contact))
    }

    pub fn resolve_for_task_create(
        connection: &Connection,
        contact_id: Option<String>,
        contact_snapshot: Option<String>,
    ) -> Result<ResolvedTaskContact, AppError> {
        let now_ms = now_ms();

        if let Some(id) = contact_id {
            let contact =
                ContactRepository::get_by_id(connection, &id).map_err(map_contact_error)?;
            if !contact.is_active {
                return Err(AppError::InvalidTaskInput {
                    message: format!("contact {id} is not available for selection"),
                });
            }
            let contact = ContactRepository::touch_recent(connection, &id, now_ms)
                .map_err(map_contact_error)?;
            return Ok(ResolvedTaskContact {
                contact_id: Some(contact.id),
                contact_snapshot: Some(contact.name),
            });
        }

        let Some(name) = normalize_optional_text(contact_snapshot) else {
            return Ok(ResolvedTaskContact {
                contact_id: None,
                contact_snapshot: None,
            });
        };

        let contact = find_or_create_by_name(connection, &name, now_ms)?;
        Ok(ResolvedTaskContact {
            contact_id: Some(contact.id),
            contact_snapshot: Some(contact.name),
        })
    }

    pub fn resolve_for_task_update(
        connection: &Connection,
        contact_id: Option<Option<String>>,
        contact_snapshot: Option<Option<String>>,
    ) -> Result<Option<ResolvedTaskContact>, AppError> {
        match (contact_id, contact_snapshot) {
            (None, None) => Ok(None),
            (Some(None), _) | (None, Some(None)) => Ok(Some(ResolvedTaskContact {
                contact_id: None,
                contact_snapshot: None,
            })),
            (Some(Some(id)), _) => {
                let resolved = Self::resolve_for_task_create(connection, Some(id), None)?;
                Ok(Some(resolved))
            }
            (None, Some(Some(name))) => {
                let resolved = Self::resolve_for_task_create(connection, None, Some(name))?;
                Ok(Some(resolved))
            }
        }
    }
}

fn find_or_create_by_name(
    connection: &Connection,
    name: &str,
    now_ms: i64,
) -> Result<Contact, AppError> {
    if let Some(existing) =
        ContactRepository::find_by_name(connection, name).map_err(map_contact_error)?
    {
        let contact = if existing.is_active {
            ContactRepository::touch_recent(connection, &existing.id, now_ms)
        } else {
            ContactRepository::reactivate(connection, &existing.id, now_ms)
        }
        .map_err(map_contact_error)?;
        return Ok(contact);
    }

    ContactRepository::create(
        connection,
        CreateContactInput {
            id: new_entity_id("contact"),
            name: name.to_string(),
            created_at_ms: now_ms,
            updated_at_ms: now_ms,
        },
    )
    .map_err(map_contact_error)
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|text| {
        let trimmed = text.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    })
}

fn contact_to_dto(contact: Contact) -> ContactDto {
    ContactDto {
        id: contact.id,
        name: contact.name,
        is_active: contact.is_active,
        created_at_ms: contact.created_at_ms,
        updated_at_ms: contact.updated_at_ms,
    }
}

fn now_ms() -> i64 {
    chrono::Local::now().timestamp_millis()
}

fn map_contact_error(error: ContactRepositoryError) -> AppError {
    match error {
        ContactRepositoryError::NotFound { id } => AppError::InvalidTaskInput {
            message: format!("contact not found: {id}"),
        },
        ContactRepositoryError::InvalidInput { message } => AppError::InvalidTaskInput { message },
        ContactRepositoryError::Db(db_error) => AppError::DatabaseError {
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
    fn create_contact_reactivates_removed_name() {
        let db = open_test_database();
        let created = ContactService::create(
            &db.connection,
            CreateContactRequest {
                name: "Anthony".to_string(),
            },
        )
        .expect("create");
        ContactService::deactivate(&db.connection, &created.id).expect("deactivate");

        let restored = ContactService::create(
            &db.connection,
            CreateContactRequest {
                name: "Anthony".to_string(),
            },
        )
        .expect("reactivate");

        assert_eq!(restored.id, created.id);
        assert!(restored.is_active);
    }

    #[test]
    fn resolve_for_task_create_uses_snapshot_and_updates_recent_order() {
        let db = open_test_database();
        let resolved =
            ContactService::resolve_for_task_create(&db.connection, None, Some("小王".to_string()))
                .expect("resolve");

        assert_eq!(resolved.contact_snapshot.as_deref(), Some("小王"));
        assert!(resolved.contact_id.is_some());

        let listed = ContactService::list_active(&db.connection).expect("list");
        assert_eq!(listed.len(), 1);
        assert_eq!(listed[0].name, "小王");
    }

    #[test]
    fn deactivate_does_not_delete_contact_row_for_history() {
        let db = open_test_database();
        let contact = ContactService::create(
            &db.connection,
            CreateContactRequest {
                name: "测试".to_string(),
            },
        )
        .expect("create");
        ContactService::deactivate(&db.connection, &contact.id).expect("deactivate");

        let stored =
            ContactRepository::get_by_id(&db.connection, &contact.id).expect("still stored");
        assert!(!stored.is_active);
        assert_eq!(stored.name, "测试");
    }
}
