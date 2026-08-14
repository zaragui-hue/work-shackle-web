use chrono::{NaiveTime, Timelike};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct ClockTime {
    pub hour: u32,
    pub minute: u32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ClockTimeError {
    InvalidFormat { value: String },
    StartNotBeforeEnd { start: String, end: String },
}

impl std::fmt::Display for ClockTimeError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::InvalidFormat { value } => {
                write!(formatter, "invalid clock time format: {value}")
            }
            Self::StartNotBeforeEnd { start, end } => write!(
                formatter,
                "work start must be before work end: {start} - {end}"
            ),
        }
    }
}

impl std::error::Error for ClockTimeError {}

pub fn parse_clock_time(value: &str) -> Result<ClockTime, ClockTimeError> {
    let trimmed = value.trim();
    let time =
        NaiveTime::parse_from_str(trimmed, "%H:%M").map_err(|_| ClockTimeError::InvalidFormat {
            value: value.to_string(),
        })?;

    Ok(ClockTime {
        hour: time.hour(),
        minute: time.minute(),
    })
}

pub fn normalize_clock_time(value: &str) -> Result<String, ClockTimeError> {
    let parsed = parse_clock_time(value)?;
    Ok(format!("{:02}:{:02}", parsed.hour, parsed.minute))
}

pub fn clock_time_to_minutes(time: &ClockTime) -> u32 {
    time.hour * 60 + time.minute
}

pub fn validate_work_time_range(start: &str, end: &str) -> Result<(), ClockTimeError> {
    let start = parse_clock_time(start)?;
    let end = parse_clock_time(end)?;

    if clock_time_to_minutes(&start) >= clock_time_to_minutes(&end) {
        return Err(ClockTimeError::StartNotBeforeEnd {
            start: format!("{:02}:{:02}", start.hour, start.minute),
            end: format!("{:02}:{:02}", end.hour, end.minute),
        });
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_and_normalize_clock_time() {
        assert_eq!(normalize_clock_time("9:30").expect("normalize"), "09:30");
        assert_eq!(normalize_clock_time(" 18:30 ").expect("normalize"), "18:30");
    }

    #[test]
    fn invalid_clock_time_is_rejected() {
        assert!(parse_clock_time("25:00").is_err());
        assert!(parse_clock_time("abc").is_err());
        assert!(parse_clock_time("930").is_err());
    }

    #[test]
    fn validate_work_time_range_requires_start_before_end() {
        validate_work_time_range("09:30", "18:30").expect("valid range");
        assert!(matches!(
            validate_work_time_range("18:30", "09:30"),
            Err(ClockTimeError::StartNotBeforeEnd { .. })
        ));
        assert!(matches!(
            validate_work_time_range("09:30", "09:30"),
            Err(ClockTimeError::StartNotBeforeEnd { .. })
        ));
    }
}
