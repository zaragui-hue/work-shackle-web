use std::path::PathBuf;

use chrono::{Datelike, Duration, NaiveDate};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct WeekFolderInfo {
    pub year: i32,
    pub month: u32,
    pub iso_week: u32,
    pub monday: NaiveDate,
    pub sunday: NaiveDate,
}

pub fn week_folder_info_for_date(date: NaiveDate) -> WeekFolderInfo {
    let monday = monday_of_week(date);
    let sunday = monday + Duration::days(6);
    let iso_week = monday.iso_week();

    WeekFolderInfo {
        year: monday.year(),
        month: monday.month(),
        iso_week: iso_week.week(),
        monday,
        sunday,
    }
}

pub fn week_folder_name(info: &WeekFolderInfo) -> String {
    format!(
        "第{}周_{:02}.{:02}-{:02}.{:02}",
        info.iso_week,
        info.monday.month(),
        info.monday.day(),
        info.sunday.month(),
        info.sunday.day()
    )
}

pub fn week_folder_relative_path(info: &WeekFolderInfo) -> PathBuf {
    PathBuf::from(format!(
        "{:04}/{:02}/{}",
        info.year,
        info.month,
        week_folder_name(info)
    ))
}

fn monday_of_week(date: NaiveDate) -> NaiveDate {
    date - Duration::days(date.weekday().num_days_from_monday() as i64)
}

#[cfg(test)]
mod tests {
    use chrono::Weekday;
    use super::*;

    fn date(value: &str) -> NaiveDate {
        NaiveDate::parse_from_str(value, "%Y-%m-%d").expect("valid test date")
    }

    #[test]
    fn cross_month_week_belongs_to_monday_month() {
        let info = week_folder_info_for_date(date("2026-09-01"));
        assert_eq!(info.year, 2026);
        assert_eq!(info.month, 8);
        assert_eq!(info.monday, date("2026-08-31"));
        assert_eq!(info.sunday, date("2026-09-06"));
        assert_eq!(info.iso_week, 36);
        assert_eq!(
            week_folder_name(&info),
            "第36周_08.31-09.06"
        );
        assert_eq!(
            week_folder_relative_path(&info),
            PathBuf::from("2026/08/第36周_08.31-09.06")
        );
    }

    #[test]
    fn same_week_dates_share_folder() {
        let monday = week_folder_info_for_date(date("2026-08-31"));
        let sunday = week_folder_info_for_date(date("2026-09-06"));
        assert_eq!(monday, sunday);
    }

    #[test]
    fn regular_in_month_week() {
        let info = week_folder_info_for_date(date("2026-08-05"));
        assert_eq!(info.month, 8);
        assert_eq!(info.monday, date("2026-08-03"));
        assert_eq!(info.sunday, date("2026-08-09"));
        assert_eq!(
            week_folder_name(&info),
            "第32周_08.03-08.09"
        );
    }

    #[test]
    fn week_starts_on_monday_and_ends_on_sunday() {
        let info = week_folder_info_for_date(date("2026-08-07"));
        assert_eq!(info.monday.weekday(), Weekday::Mon);
        assert_eq!(info.sunday.weekday(), Weekday::Sun);
        assert_eq!(info.sunday - info.monday, Duration::days(6));
    }
}
