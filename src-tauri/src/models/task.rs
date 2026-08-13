use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    pub note: Option<String>,
    pub planned_at_ms: i64,
    pub deadline_at_ms: Option<i64>,
    pub priority: i32,
    pub status: String,
    pub contact_id: Option<String>,
    pub contact_snapshot: Option<String>,
    pub created_at_ms: i64,
    pub completed_at_ms: Option<i64>,
    pub cancelled_at_ms: Option<i64>,
    pub updated_at_ms: i64,
}
