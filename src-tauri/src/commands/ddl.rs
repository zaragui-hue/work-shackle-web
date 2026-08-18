use crate::errors::AppError;
use crate::time::ddl::{ddl_progress, DdlProgress};

pub fn compute_ddl_progress_value(
    planned_at_ms: i64,
    deadline_at_ms: i64,
    now_ms: i64,
) -> Result<DdlProgress, AppError> {
    ddl_progress(planned_at_ms, deadline_at_ms, now_ms).map_err(|error| AppError::InvalidDeadline {
        message: error.to_string(),
    })
}

#[tauri::command]
pub fn compute_ddl_progress(
    planned_at_ms: i64,
    deadline_at_ms: i64,
    now_ms: i64,
) -> Result<DdlProgress, AppError> {
    compute_ddl_progress_value(planned_at_ms, deadline_at_ms, now_ms)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::time::ddl::DdlEmotion;

    const PLANNED: i64 = 1_000_000;
    const SPAN: i64 = 10_000;
    const DEADLINE: i64 = PLANNED + SPAN;

    #[test]
    fn valid_interval_reuses_time_module_progress() {
        let at_forty =
            compute_ddl_progress_value(PLANNED, DEADLINE, PLANNED + 4_000).expect("valid interval");

        assert_eq!(at_forty.emotion, DdlEmotion::Calm);
        assert!(!at_forty.is_overdue);
        assert!((at_forty.progress_ratio - 0.4).abs() < 1e-12);
        assert_eq!(at_forty.remaining_ms, 6_000);
    }

    #[test]
    fn invalid_interval_is_invalid_deadline() {
        let equal = compute_ddl_progress_value(PLANNED, PLANNED, PLANNED);
        assert!(matches!(equal, Err(AppError::InvalidDeadline { .. })));

        let inverted = compute_ddl_progress_value(DEADLINE, PLANNED, PLANNED);
        assert!(matches!(inverted, Err(AppError::InvalidDeadline { .. })));
    }
}
