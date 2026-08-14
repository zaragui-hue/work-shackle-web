use chrono::{Local, NaiveTime, TimeZone, Timelike};

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

pub fn local_minutes_from_timestamp_ms(timestamp_ms: i64) -> u32 {
    let local = Local
        .timestamp_millis_opt(timestamp_ms)
        .single()
        .expect("timestamp must map to a valid local datetime");
    local.time().hour() * 60 + local.time().minute()
}

pub fn is_local_time_in_half_open_range(
    timestamp_ms: i64,
    start: &str,
    end: &str,
) -> Result<bool, ClockTimeError> {
    let start = parse_clock_time(start)?;
    let end = parse_clock_time(end)?;
    let now = local_minutes_from_timestamp_ms(timestamp_ms);
    Ok(now >= clock_time_to_minutes(&start) && now < clock_time_to_minutes(&end))
}

pub fn is_local_time_at_or_after_on_work_date(
    timestamp_ms: i64,
    work_date: chrono::NaiveDate,
    clock_time: &str,
) -> Result<bool, ClockTimeError> {
    use crate::time::calendar_day::{is_local_calendar_day_before, is_same_local_calendar_day};

    if is_local_calendar_day_before(timestamp_ms, work_date) {
        return Ok(false);
    }
    if !is_same_local_calendar_day(timestamp_ms, work_date) {
        return Ok(true);
    }

    let threshold = clock_time_to_minutes(&parse_clock_time(clock_time)?);
    let now = local_minutes_from_timestamp_ms(timestamp_ms);
    Ok(now >= threshold)
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

    #[test]
    fn half_open_range_excludes_end_boundary() {
        use chrono::{Local, NaiveDateTime, TimeZone};

        fn local_ms(date: &str, time: &str) -> i64 {
            let naive = NaiveDateTime::parse_from_str(&format!("{date} {time}"), "%Y-%m-%d %H:%M")
                .expect("valid");
            Local
                .from_local_datetime(&naive)
                .single()
                .expect("valid local datetime")
                .timestamp_millis()
        }

        assert!(is_local_time_in_half_open_range(
            local_ms("2026-08-14", "12:00"),
            "12:00",
            "13:00"
        )
        .expect("start"));
        assert!(is_local_time_in_half_open_range(
            local_ms("2026-08-14", "12:59"),
            "12:00",
            "13:00"
        )
        .expect("inside"));
        assert!(!is_local_time_in_half_open_range(
            local_ms("2026-08-14", "13:00"),
            "12:00",
            "13:00"
        )
        .expect("end"));
    }

    #[test]
    fn at_or_after_on_work_date_respects_end_boundary() {
        use chrono::{Local, NaiveDate, NaiveDateTime, TimeZone};

        fn local_ms(date: &str, time: &str) -> i64 {
            let naive = NaiveDateTime::parse_from_str(&format!("{date} {time}"), "%Y-%m-%d %H:%M")
                .expect("valid");
            Local
                .from_local_datetime(&naive)
                .single()
                .expect("valid local datetime")
                .timestamp_millis()
        }

        let work_date = NaiveDate::from_ymd_opt(2026, 8, 14).expect("date");
        assert!(!is_local_time_at_or_after_on_work_date(
            local_ms("2026-08-14", "17:59"),
            work_date,
            "18:00"
        )
        .expect("before end"));
        assert!(is_local_time_at_or_after_on_work_date(
            local_ms("2026-08-14", "18:00"),
            work_date,
            "18:00"
        )
        .expect("at end"));
        assert!(is_local_time_at_or_after_on_work_date(
            local_ms("2026-08-15", "09:00"),
            work_date,
            "18:00"
        )
        .expect("next day"));
        assert!(!is_local_time_at_or_after_on_work_date(
            local_ms("2026-08-13", "20:00"),
            work_date,
            "18:00"
        )
        .expect("previous day"));
    }
}
