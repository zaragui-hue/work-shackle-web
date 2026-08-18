use chrono::{Datelike, Duration, NaiveDate};

use super::calendar_day::{local_half_open_range_ms, local_start_of_day_ms, parse_local_date};
use super::week_folder::week_folder_info_for_date;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HistoryTimeMode {
    Day,
    Week,
    Month,
    Quarter,
    Year,
    Custom,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct HistoryTimeRange {
    pub start_ms: i64,
    pub end_ms: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HistoryRangeInput {
    pub mode: HistoryTimeMode,
    pub anchor_date: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

pub fn resolve_history_range(input: HistoryRangeInput) -> Result<HistoryTimeRange, String> {
    match input.mode {
        HistoryTimeMode::Day => {
            let anchor = parse_anchor_date(input.anchor_date)?;
            let end = anchor
                .succ_opt()
                .ok_or_else(|| "anchor date overflow".to_string())?;
            Ok(HistoryTimeRange {
                start_ms: local_start_of_day_ms(anchor),
                end_ms: local_start_of_day_ms(end),
            })
        }
        HistoryTimeMode::Week => {
            let anchor = parse_anchor_date(input.anchor_date)?;
            let week = week_folder_info_for_date(anchor);
            let end = week.monday + Duration::days(7);
            Ok(HistoryTimeRange {
                start_ms: local_start_of_day_ms(week.monday),
                end_ms: local_start_of_day_ms(end),
            })
        }
        HistoryTimeMode::Month => {
            let anchor = parse_anchor_date(input.anchor_date)?;
            let start = first_day_of_month(anchor.year(), anchor.month());
            let end = next_month_start(start);
            Ok(HistoryTimeRange {
                start_ms: local_start_of_day_ms(start),
                end_ms: local_start_of_day_ms(end),
            })
        }
        HistoryTimeMode::Quarter => {
            let anchor = parse_anchor_date(input.anchor_date)?;
            let start = quarter_start(anchor);
            let end = next_quarter_start(start);
            Ok(HistoryTimeRange {
                start_ms: local_start_of_day_ms(start),
                end_ms: local_start_of_day_ms(end),
            })
        }
        HistoryTimeMode::Year => {
            let anchor = parse_anchor_date(input.anchor_date)?;
            let start = first_day_of_month(anchor.year(), 1);
            let end = first_day_of_month(anchor.year() + 1, 1);
            Ok(HistoryTimeRange {
                start_ms: local_start_of_day_ms(start),
                end_ms: local_start_of_day_ms(end),
            })
        }
        HistoryTimeMode::Custom => {
            let start_value = input
                .start_date
                .as_deref()
                .ok_or_else(|| "custom range requires start date".to_string())?;
            let end_value = input
                .end_date
                .as_deref()
                .ok_or_else(|| "custom range requires end date".to_string())?;
            let start = parse_local_date(start_value)?;
            let end = parse_local_date(end_value)?;
            let (start_ms, end_ms) = local_half_open_range_ms(start, end)?;
            Ok(HistoryTimeRange { start_ms, end_ms })
        }
    }
}

fn parse_anchor_date(value: Option<String>) -> Result<NaiveDate, String> {
    let raw = value.ok_or_else(|| "anchor date is required".to_string())?;
    parse_local_date(&raw)
}

fn first_day_of_month(year: i32, month: u32) -> NaiveDate {
    NaiveDate::from_ymd_opt(year, month, 1).expect("month start must be valid")
}

fn next_month_start(date: NaiveDate) -> NaiveDate {
    if date.month() == 12 {
        first_day_of_month(date.year() + 1, 1)
    } else {
        first_day_of_month(date.year(), date.month() + 1)
    }
}

fn quarter_start(date: NaiveDate) -> NaiveDate {
    let quarter_index = (date.month() - 1) / 3;
    first_day_of_month(date.year(), quarter_index * 3 + 1)
}

fn next_quarter_start(date: NaiveDate) -> NaiveDate {
    match date.month() {
        1 => first_day_of_month(date.year(), 4),
        4 => first_day_of_month(date.year(), 7),
        7 => first_day_of_month(date.year(), 10),
        10 => first_day_of_month(date.year() + 1, 1),
        _ => unreachable!("quarter start must be Jan/Apr/Jul/Oct"),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Local, NaiveDateTime, TimeZone};

    fn date(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").expect("valid test date")
    }

    fn local_ms(date: &str, time: &str) -> i64 {
        let naive = NaiveDateTime::parse_from_str(&format!("{date} {time}"), "%Y-%m-%d %H:%M")
            .expect("valid");
        Local
            .from_local_datetime(&naive)
            .single()
            .expect("valid local datetime")
            .timestamp_millis()
    }

    fn resolve(mode: HistoryTimeMode, anchor: &str) -> HistoryTimeRange {
        resolve_history_range(HistoryRangeInput {
            mode,
            anchor_date: Some(anchor.to_string()),
            start_date: None,
            end_date: None,
        })
        .expect("resolve range")
    }

    #[test]
    fn day_range_uses_local_midnight_half_open_interval() {
        let range = resolve(HistoryTimeMode::Day, "2026-08-18");
        assert_eq!(range.start_ms, local_ms("2026-08-18", "00:00"));
        assert_eq!(range.end_ms, local_ms("2026-08-19", "00:00"));
    }

    #[test]
    fn day_range_includes_boundary_day_and_excludes_next_day() {
        let range = resolve(HistoryTimeMode::Day, "2026-08-18");
        assert!(local_ms("2026-08-18", "00:00") >= range.start_ms);
        assert!(local_ms("2026-08-18", "23:59") < range.end_ms);
        assert!(local_ms("2026-08-19", "00:00") >= range.end_ms);
    }

    #[test]
    fn week_range_uses_monday_first_project_rule() {
        let range = resolve(HistoryTimeMode::Week, "2026-09-01");
        assert_eq!(range.start_ms, local_ms("2026-08-31", "00:00"));
        assert_eq!(range.end_ms, local_ms("2026-09-07", "00:00"));
    }

    #[test]
    fn month_range_spans_natural_month() {
        let range = resolve(HistoryTimeMode::Month, "2026-08-15");
        assert_eq!(range.start_ms, local_ms("2026-08-01", "00:00"));
        assert_eq!(range.end_ms, local_ms("2026-09-01", "00:00"));
    }

    #[test]
    fn quarter_q3_range_spans_jul_to_sep() {
        let range = resolve(HistoryTimeMode::Quarter, "2026-08-15");
        assert_eq!(range.start_ms, local_ms("2026-07-01", "00:00"));
        assert_eq!(range.end_ms, local_ms("2026-10-01", "00:00"));
    }

    #[test]
    fn year_range_spans_calendar_year() {
        let range = resolve(HistoryTimeMode::Year, "2026-06-01");
        assert_eq!(range.start_ms, local_ms("2026-01-01", "00:00"));
        assert_eq!(range.end_ms, local_ms("2027-01-01", "00:00"));
    }

    #[test]
    fn custom_range_includes_both_endpoints_as_natural_days() {
        let range = resolve_history_range(HistoryRangeInput {
            mode: HistoryTimeMode::Custom,
            anchor_date: None,
            start_date: Some("2026-08-30".to_string()),
            end_date: Some("2026-09-02".to_string()),
        })
        .expect("custom range");

        assert_eq!(range.start_ms, local_ms("2026-08-30", "00:00"));
        assert_eq!(range.end_ms, local_ms("2026-09-03", "00:00"));
    }

    #[test]
    fn custom_range_allows_start_equals_end() {
        let range = resolve_history_range(HistoryRangeInput {
            mode: HistoryTimeMode::Custom,
            anchor_date: None,
            start_date: Some("2026-08-18".to_string()),
            end_date: Some("2026-08-18".to_string()),
        })
        .expect("single-day custom range");

        assert_eq!(range.start_ms, local_ms("2026-08-18", "00:00"));
        assert_eq!(range.end_ms, local_ms("2026-08-19", "00:00"));
    }

    #[test]
    fn custom_range_rejects_start_after_end() {
        let error = resolve_history_range(HistoryRangeInput {
            mode: HistoryTimeMode::Custom,
            anchor_date: None,
            start_date: Some("2026-08-20".to_string()),
            end_date: Some("2026-08-18".to_string()),
        })
        .expect_err("invalid custom range");

        assert!(error.contains("start date must not be after end date"));
    }

    #[test]
    fn custom_range_requires_both_dates() {
        let missing_end = resolve_history_range(HistoryRangeInput {
            mode: HistoryTimeMode::Custom,
            anchor_date: None,
            start_date: Some("2026-08-18".to_string()),
            end_date: None,
        })
        .expect_err("missing end");
        assert!(missing_end.contains("end date"));

        let missing_start = resolve_history_range(HistoryRangeInput {
            mode: HistoryTimeMode::Custom,
            anchor_date: None,
            start_date: None,
            end_date: Some("2026-08-18".to_string()),
        })
        .expect_err("missing start");
        assert!(missing_start.contains("start date"));
    }

    #[test]
    fn ranges_do_not_use_workday_cutoff() {
        let range = resolve(HistoryTimeMode::Day, "2026-08-18");
        assert!(local_ms("2026-08-18", "04:30") >= range.start_ms);
        assert!(local_ms("2026-08-18", "04:30") < range.end_ms);
    }

    #[test]
    fn month_range_crosses_month_boundary() {
        let range = resolve(HistoryTimeMode::Month, "2026-12-31");
        assert_eq!(range.start_ms, local_ms("2026-12-01", "00:00"));
        assert_eq!(range.end_ms, local_ms("2027-01-01", "00:00"));
    }

    #[test]
    fn quarter_range_crosses_year_boundary() {
        let range = resolve(HistoryTimeMode::Quarter, "2026-11-15");
        assert_eq!(range.start_ms, local_ms("2026-10-01", "00:00"));
        assert_eq!(range.end_ms, local_ms("2027-01-01", "00:00"));
    }
}
