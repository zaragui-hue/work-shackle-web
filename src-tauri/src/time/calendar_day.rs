use chrono::{Duration, Local, NaiveDate, TimeZone};

pub fn format_work_date(date: NaiveDate) -> String {
    date.format("%Y-%m-%d").to_string()
}

pub fn parse_local_date(value: &str) -> Result<NaiveDate, String> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d")
        .map_err(|error| format!("invalid local calendar date `{value}`: {error}"))
}

pub fn local_dates_inclusive(start: NaiveDate, end: NaiveDate) -> Vec<NaiveDate> {
    let mut dates = Vec::new();
    let mut current = start;
    while current <= end {
        dates.push(current);
        current += Duration::days(1);
    }
    dates
}

/// Local calendar date for an absolute instant (ms). Uses normal calendar days, not 05:00 cutoff.
pub fn local_date_from_ms(timestamp_ms: i64) -> NaiveDate {
    Local
        .timestamp_millis_opt(timestamp_ms)
        .single()
        .expect("timestamp must map to a valid local datetime")
        .date_naive()
}

pub fn is_same_local_calendar_day(timestamp_ms: i64, day: NaiveDate) -> bool {
    local_date_from_ms(timestamp_ms) == day
}

pub fn is_local_calendar_day_before(timestamp_ms: i64, day: NaiveDate) -> bool {
    local_date_from_ms(timestamp_ms) < day
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDateTime;

    fn local_ms(date: &str, time: &str) -> i64 {
        let naive = NaiveDateTime::parse_from_str(&format!("{date} {time}"), "%Y-%m-%d %H:%M")
            .expect("valid");
        Local
            .from_local_datetime(&naive)
            .single()
            .expect("valid local datetime")
            .timestamp_millis()
    }

    #[test]
    fn parse_local_date_accepts_yyyy_mm_dd() {
        let parsed = parse_local_date("2026-08-14").expect("parse date");
        assert_eq!(parsed, NaiveDate::from_ymd_opt(2026, 8, 14).expect("date"));
    }

    #[test]
    fn local_dates_inclusive_spans_month_and_year_boundaries() {
        let start = NaiveDate::from_ymd_opt(2025, 12, 30).expect("start");
        let end = NaiveDate::from_ymd_opt(2026, 1, 2).expect("end");
        assert_eq!(
            local_dates_inclusive(start, end),
            vec![
                NaiveDate::from_ymd_opt(2025, 12, 30).expect("date"),
                NaiveDate::from_ymd_opt(2025, 12, 31).expect("date"),
                NaiveDate::from_ymd_opt(2026, 1, 1).expect("date"),
                NaiveDate::from_ymd_opt(2026, 1, 2).expect("date"),
            ]
        );
    }

    #[test]
    fn local_date_from_ms_uses_local_calendar_day() {
        let day = NaiveDate::from_ymd_opt(2026, 8, 14).expect("date");
        assert_eq!(local_date_from_ms(local_ms("2026-08-14", "00:00")), day);
        assert_eq!(local_date_from_ms(local_ms("2026-08-14", "23:59")), day);
        assert_eq!(
            local_date_from_ms(local_ms("2026-08-15", "00:00")),
            NaiveDate::from_ymd_opt(2026, 8, 15).expect("date")
        );
    }

    #[test]
    fn is_same_local_calendar_day_matches_day_boundary() {
        let day = NaiveDate::from_ymd_opt(2026, 8, 14).expect("date");
        assert!(is_same_local_calendar_day(
            local_ms("2026-08-14", "09:30"),
            day
        ));
        assert!(!is_same_local_calendar_day(
            local_ms("2026-08-13", "23:59"),
            day
        ));
    }

    #[test]
    fn is_local_calendar_day_before_compares_calendar_dates_only() {
        let today = NaiveDate::from_ymd_opt(2026, 8, 14).expect("date");
        assert!(is_local_calendar_day_before(
            local_ms("2026-08-13", "23:59"),
            today
        ));
        assert!(!is_local_calendar_day_before(
            local_ms("2026-08-14", "14:00"),
            today
        ));
    }
}
