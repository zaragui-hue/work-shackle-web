use uuid::Uuid;

pub fn new_entity_id(prefix: &str) -> String {
    format!("{prefix}-{}", Uuid::new_v4())
}

#[cfg(test)]
mod tests {
    use std::collections::HashSet;

    use super::*;

    #[test]
    fn new_entity_id_uses_expected_prefix() {
        let id = new_entity_id("task");
        assert!(id.starts_with("task-"));
        assert!(id.len() > "task-".len());
    }

    #[test]
    fn new_entity_id_generates_unique_values_under_rapid_creation() {
        let mut ids = HashSet::new();
        for _ in 0..1_000 {
            let id = new_entity_id("task");
            assert!(ids.insert(id), "duplicate entity id generated");
        }
    }
}
