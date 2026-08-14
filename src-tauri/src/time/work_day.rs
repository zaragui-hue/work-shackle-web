use chrono::{Local, NaiveDate, NaiveTime, TimeZone};

use super::calendar_day::format_work_date;

const WORKDAY_CUTOFF_HOUR: u32 = 5;
const WORKDAY_CUTOFF_MINUTE: u32 = 0;

/// Work-date ownership for work status and overtime (local 05:00 cutoff).
pub fn work_date_from_local_now() -> NaiveDate {
    work_date_from_timestamp_ms(Local::now().timestamp_millis())
}

pub fn work_date_from_timestamp_ms(timestamp_ms: i64) -> NaiveDate {
    let local = Local
        .timestamp_millis_opt(timestamp_ms)
        .single()
        .expect("timestamp must map to a valid local datetime");
    let calendar_date = local.date_naive();
    let cutoff = NaiveTime::from_hms_opt(WORKDAY_CUTOFF_HOUR, WORKDAY_CUTOFF_MINUTE, 0)
        .expect("valid cutoff time");
    if local.time() < cutoff {
        calendar_date
            .pred_opt()
            .expect("calendar date must have a previous day")
    } else {
        calendar_date
    }
}

pub fn format_current_work_date() -> String {
    format_work_date(work_date_from_local_now())
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
    fn before_0500_belongs_to_previous_work_date() {
        let work_date = work_date_from_timestamp_ms(local_ms("2026-08-14", "04:59"));
        assert_eq!(
            work_date,
            NaiveDate::from_ymd_opt(2026, 8, 13).expect("date")
        );
    }

    #[test]
    fn at_or_after_0500_belongs_to_current_work_date() {
        let at_cutoff = work_date_from_timestamp_ms(local_ms("2026-08-14", "05:00"));
        assert_eq!(
            at_cutoff,
            NaiveDate::from_ymd_opt(2026, 8, 14).expect("date")
        );

        let later = work_date_from_timestamp_ms(local_ms("2026-08-14", "23:59"));
        assert_eq!(later, NaiveDate::from_ymd_opt(2026, 8, 14).expect("date"));
    }

    #[test]
    fn midnight_still_belongs_to_previous_work_date() {
        let work_date = work_date_from_timestamp_ms(local_ms("2026-08-15", "00:30"));
        assert_eq!(
            work_date,
            NaiveDate::from_ymd_opt(2026, 8, 14).expect("date")
        );
    }
}
