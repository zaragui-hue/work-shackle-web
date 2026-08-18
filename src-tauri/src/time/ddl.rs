use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum DdlEmotion {
    Calm,
    Notice,
    Anxious,
    Panic,
    Burning,
    Overdue,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DdlProgress {
    pub progress_ratio: f64,
    pub remaining_ms: i64,
    pub is_overdue: bool,
    pub emotion: DdlEmotion,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DdlProgressError {
    InvalidInterval {
        planned_at_ms: i64,
        deadline_at_ms: i64,
    },
}

impl std::fmt::Display for DdlProgressError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidInterval {
                planned_at_ms,
                deadline_at_ms,
            } => write!(
                formatter,
                "deadline must be after planned time: planned={planned_at_ms}, deadline={deadline_at_ms}"
            ),
        }
    }
}

impl std::error::Error for DdlProgressError {}

pub fn ddl_progress(
    planned_at_ms: i64,
    deadline_at_ms: i64,
    now_ms: i64,
) -> Result<DdlProgress, DdlProgressError> {
    if deadline_at_ms <= planned_at_ms {
        return Err(DdlProgressError::InvalidInterval {
            planned_at_ms,
            deadline_at_ms,
        });
    }

    let remaining_ms = deadline_at_ms - now_ms;
    if now_ms <= planned_at_ms {
        return Ok(DdlProgress {
            progress_ratio: 0.0,
            remaining_ms,
            is_overdue: false,
            emotion: DdlEmotion::Calm,
        });
    }

    let span = deadline_at_ms - planned_at_ms;
    let elapsed = now_ms - planned_at_ms;
    let progress_ratio = elapsed as f64 / span as f64;
    let is_overdue = now_ms > deadline_at_ms;
    let emotion = if is_overdue {
        DdlEmotion::Overdue
    } else if at_most_percent(elapsed, span, 40) {
        DdlEmotion::Calm
    } else if at_most_percent(elapsed, span, 65) {
        DdlEmotion::Notice
    } else if at_most_percent(elapsed, span, 80) {
        DdlEmotion::Anxious
    } else if at_most_percent(elapsed, span, 95) {
        DdlEmotion::Panic
    } else {
        DdlEmotion::Burning
    };

    Ok(DdlProgress {
        progress_ratio,
        remaining_ms,
        is_overdue,
        emotion,
    })
}

fn at_most_percent(elapsed_ms: i64, span_ms: i64, percent: i64) -> bool {
    (elapsed_ms as i128) * 100 <= (span_ms as i128) * (percent as i128)
}

#[cfg(test)]
mod tests {
    use super::*;

    const PLANNED: i64 = 1_000_000;
    const SPAN: i64 = 10_000;
    const DEADLINE: i64 = PLANNED + SPAN;

    fn progress_at(now_ms: i64) -> DdlProgress {
        ddl_progress(PLANNED, DEADLINE, now_ms).expect("valid interval")
    }

    fn assert_ratio(actual: f64, expected: f64) {
        assert!(
            (actual - expected).abs() < 1e-12,
            "progress_ratio {actual} != {expected}"
        );
    }

    #[test]
    fn zero_to_forty_is_calm() {
        let at_planned = progress_at(PLANNED);
        assert_eq!(at_planned.emotion, DdlEmotion::Calm);
        assert!(!at_planned.is_overdue);
        assert_ratio(at_planned.progress_ratio, 0.0);
        assert_eq!(at_planned.remaining_ms, SPAN);

        let before_planned = progress_at(PLANNED - 1_000);
        assert_eq!(before_planned.emotion, DdlEmotion::Calm);
        assert_ratio(before_planned.progress_ratio, 0.0);
        assert_eq!(before_planned.remaining_ms, SPAN + 1_000);

        let at_forty = progress_at(PLANNED + 4_000);
        assert_eq!(at_forty.emotion, DdlEmotion::Calm);
        assert_ratio(at_forty.progress_ratio, 0.4);
        assert_eq!(at_forty.remaining_ms, 6_000);
    }

    #[test]
    fn forty_to_sixty_five_is_notice() {
        let just_over_forty = progress_at(PLANNED + 4_001);
        assert_eq!(just_over_forty.emotion, DdlEmotion::Notice);
        assert!(!just_over_forty.is_overdue);

        let at_sixty_five = progress_at(PLANNED + 6_500);
        assert_eq!(at_sixty_five.emotion, DdlEmotion::Notice);
        assert_ratio(at_sixty_five.progress_ratio, 0.65);
        assert_eq!(at_sixty_five.remaining_ms, 3_500);
    }

    #[test]
    fn sixty_five_to_eighty_is_anxious() {
        let just_over_sixty_five = progress_at(PLANNED + 6_501);
        assert_eq!(just_over_sixty_five.emotion, DdlEmotion::Anxious);

        let at_eighty = progress_at(PLANNED + 8_000);
        assert_eq!(at_eighty.emotion, DdlEmotion::Anxious);
        assert_ratio(at_eighty.progress_ratio, 0.8);
        assert_eq!(at_eighty.remaining_ms, 2_000);
    }

    #[test]
    fn eighty_to_ninety_five_is_panic() {
        let just_over_eighty = progress_at(PLANNED + 8_001);
        assert_eq!(just_over_eighty.emotion, DdlEmotion::Panic);

        let at_ninety_five = progress_at(PLANNED + 9_500);
        assert_eq!(at_ninety_five.emotion, DdlEmotion::Panic);
        assert_ratio(at_ninety_five.progress_ratio, 0.95);
        assert_eq!(at_ninety_five.remaining_ms, 500);
    }

    #[test]
    fn ninety_five_to_one_hundred_is_burning() {
        let just_over_ninety_five = progress_at(PLANNED + 9_501);
        assert_eq!(just_over_ninety_five.emotion, DdlEmotion::Burning);
        assert!(!just_over_ninety_five.is_overdue);

        let just_before_deadline = progress_at(DEADLINE - 1);
        assert_eq!(just_before_deadline.emotion, DdlEmotion::Burning);
        assert!(!just_before_deadline.is_overdue);
        assert_eq!(just_before_deadline.remaining_ms, 1);

        let at_deadline = progress_at(DEADLINE);
        assert_eq!(at_deadline.emotion, DdlEmotion::Burning);
        assert!(!at_deadline.is_overdue);
        assert_ratio(at_deadline.progress_ratio, 1.0);
        assert_eq!(at_deadline.remaining_ms, 0);
    }

    #[test]
    fn after_deadline_is_overdue() {
        let after_deadline = progress_at(DEADLINE + 1);
        assert_eq!(after_deadline.emotion, DdlEmotion::Overdue);
        assert!(after_deadline.is_overdue);
        assert_ratio(after_deadline.progress_ratio, 1.0001);
        assert_eq!(after_deadline.remaining_ms, -1);

        let later = progress_at(DEADLINE + 1_000);
        assert_eq!(later.emotion, DdlEmotion::Overdue);
        assert!(later.is_overdue);
        assert_ratio(later.progress_ratio, 1.1);
        assert_eq!(later.remaining_ms, -1_000);
    }

    #[test]
    fn invalid_interval_is_rejected() {
        let equal = ddl_progress(PLANNED, PLANNED, PLANNED);
        assert_eq!(
            equal,
            Err(DdlProgressError::InvalidInterval {
                planned_at_ms: PLANNED,
                deadline_at_ms: PLANNED,
            })
        );

        let inverted = ddl_progress(DEADLINE, PLANNED, PLANNED);
        assert_eq!(
            inverted,
            Err(DdlProgressError::InvalidInterval {
                planned_at_ms: DEADLINE,
                deadline_at_ms: PLANNED,
            })
        );
    }
}
