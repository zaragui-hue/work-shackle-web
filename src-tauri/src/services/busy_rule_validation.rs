use serde::Deserialize;

use crate::db::repositories::busy_rule_repository::BusyLevelWriteInput;
use crate::errors::AppError;

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBusyLevelInput {
    pub min_tasks: i32,
    pub max_tasks: Option<i32>,
    pub emoji: String,
    pub name: String,
    pub messages: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBusyRulesRequest {
    pub levels: Vec<SaveBusyLevelInput>,
}

pub fn normalize_busy_levels(
    input: &SaveBusyRulesRequest,
) -> Result<Vec<BusyLevelWriteInput>, AppError> {
    if input.levels.is_empty() {
        return Err(invalid_input("至少保留一个忙碌档位"));
    }

    let mut normalized = Vec::with_capacity(input.levels.len());
    for level in &input.levels {
        normalized.push(normalize_level(level)?);
    }

    normalized.sort_by_key(|level| level.min_tasks);
    Ok(normalized)
}

fn normalize_level(level: &SaveBusyLevelInput) -> Result<BusyLevelWriteInput, AppError> {
    let emoji = level.emoji.trim();
    let name = level.name.trim();
    if emoji.is_empty() {
        return Err(invalid_input("Emoji 不能为空"));
    }
    if name.is_empty() {
        return Err(invalid_input("状态名称不能为空"));
    }
    if level.min_tasks < 0 {
        return Err(invalid_input("任务数不能为负数"));
    }
    if let Some(max_tasks) = level.max_tasks {
        if max_tasks < 0 {
            return Err(invalid_input("任务数不能为负数"));
        }
        if max_tasks < level.min_tasks {
            return Err(invalid_input("最大任务数不能小于最小任务数"));
        }
    }

    let messages: Vec<String> = level
        .messages
        .iter()
        .map(|message| message.trim())
        .filter(|message| !message.is_empty())
        .map(|message| message.to_string())
        .collect();
    if messages.is_empty() {
        return Err(invalid_input("每个档位至少保留一条文案"));
    }

    Ok(BusyLevelWriteInput {
        min_tasks: level.min_tasks,
        max_tasks: level.max_tasks,
        emoji: emoji.to_string(),
        name: name.to_string(),
        messages,
    })
}

pub fn validate_busy_level_set(levels: &[BusyLevelWriteInput]) -> Result<(), AppError> {
    if levels.is_empty() {
        return Err(invalid_input("至少保留一个忙碌档位"));
    }

    if levels[0].min_tasks != 0 {
        return Err(invalid_input("第一档必须从 0 开始"));
    }

    for (index, level) in levels.iter().enumerate() {
        let is_last = index + 1 == levels.len();

        if level.min_tasks < 0 {
            return Err(invalid_input("任务数不能为负数"));
        }

        match level.max_tasks {
            None if is_last => {}
            None => return Err(invalid_input("只有最后一档可以没有上限")),
            Some(max_tasks) if is_last => {
                return Err(invalid_input("最后一档必须为 X+"));
            }
            Some(max_tasks) => {
                if max_tasks < level.min_tasks {
                    return Err(invalid_input("最大任务数不能小于最小任务数"));
                }
            }
        }

        if level.emoji.trim().is_empty() {
            return Err(invalid_input("Emoji 不能为空"));
        }
        if level.name.trim().is_empty() {
            return Err(invalid_input("状态名称不能为空"));
        }
        if level.messages.is_empty() {
            return Err(invalid_input("每个档位至少保留一条文案"));
        }
    }

    for index in 1..levels.len() {
        let previous = &levels[index - 1];
        let current = &levels[index];
        let previous_max = previous
            .max_tasks
            .expect("non-final level must have max_tasks");
        let expected_min = previous_max
            .checked_add(1)
            .ok_or_else(|| invalid_input("忙碌档位范围无效"))?;

        if current.min_tasks < expected_min {
            return Err(invalid_input("忙碌档位范围重叠"));
        }
        if current.min_tasks > expected_min {
            return Err(invalid_input("忙碌档位之间存在空档"));
        }
    }

    Ok(())
}

pub fn resolve_busy_level<'a>(
    task_count: i32,
    levels: &'a [BusyLevelWriteInput],
) -> Option<&'a BusyLevelWriteInput> {
    if task_count < 0 || levels.is_empty() {
        return None;
    }

    for level in levels {
        if task_count >= level.min_tasks
            && level
                .max_tasks
                .map(|max_tasks| task_count <= max_tasks)
                .unwrap_or(true)
        {
            return Some(level);
        }
    }

    levels.last()
}

fn invalid_input(message: &str) -> AppError {
    AppError::InvalidTaskInput {
        message: message.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::repositories::busy_rule_repository::DEFAULT_BUSY_LEVELS;

    fn level(min_tasks: i32, max_tasks: Option<i32>, name: &str) -> BusyLevelWriteInput {
        BusyLevelWriteInput {
            min_tasks,
            max_tasks,
            emoji: "🙂".to_string(),
            name: name.to_string(),
            messages: vec!["文案".to_string()],
        }
    }

    fn request(levels: Vec<SaveBusyLevelInput>) -> SaveBusyRulesRequest {
        SaveBusyRulesRequest { levels }
    }

    fn input(min_tasks: i32, max_tasks: Option<i32>, name: &str) -> SaveBusyLevelInput {
        SaveBusyLevelInput {
            min_tasks,
            max_tasks,
            emoji: "🙂".to_string(),
            name: name.to_string(),
            messages: vec!["文案".to_string()],
        }
    }

    #[test]
    fn default_levels_pass_validation() {
        let levels: Vec<BusyLevelWriteInput> = DEFAULT_BUSY_LEVELS
            .iter()
            .map(|level| BusyLevelWriteInput {
                min_tasks: level.min_tasks,
                max_tasks: level.max_tasks,
                emoji: level.emoji.to_string(),
                name: level.name.to_string(),
                messages: vec![level.message.to_string()],
            })
            .collect();

        validate_busy_level_set(&levels).expect("defaults valid");
    }

    #[test]
    fn custom_valid_ranges_pass() {
        validate_busy_level_set(&[
            level(0, Some(1), "低"),
            level(2, Some(4), "中"),
            level(5, None, "高"),
        ])
        .expect("valid custom");
    }

    #[test]
    fn single_open_ended_level_passes() {
        validate_busy_level_set(&[level(0, None, "唯一")]).expect("single 0+ valid");
    }

    #[test]
    fn rejects_empty_levels_after_normalize() {
        let err = normalize_busy_levels(&request(vec![])).expect_err("empty");
        assert!(matches!(err, AppError::InvalidTaskInput { .. }));
    }

    #[test]
    fn rejects_first_level_not_starting_at_zero() {
        let err = validate_busy_level_set(&[level(1, Some(2), "错"), level(3, None, "末")])
            .expect_err("first not zero");
        assert_invalid_message(err, "第一档必须从 0 开始");
    }

    #[test]
    fn rejects_gap_between_levels() {
        let err = validate_busy_level_set(&[
            level(0, Some(2), "前"),
            level(4, Some(5), "中"),
            level(6, None, "末"),
        ])
        .expect_err("gap");
        assert_invalid_message(err, "空档");
    }

    #[test]
    fn rejects_overlap_between_levels() {
        let err = validate_busy_level_set(&[
            level(0, Some(3), "前"),
            level(3, Some(5), "中"),
            level(6, None, "末"),
        ])
        .expect_err("overlap");
        assert_invalid_message(err, "重叠");
    }

    #[test]
    fn rejects_final_level_without_open_ended_max() {
        let err = validate_busy_level_set(&[
            level(0, Some(2), "前"),
            level(3, Some(5), "中"),
            level(6, Some(10), "末"),
        ])
        .expect_err("final bounded");
        assert_invalid_message(err, "最后一档必须为 X+");
    }

    #[test]
    fn rejects_middle_level_without_max() {
        let err = validate_busy_level_set(&[
            level(0, Some(2), "前"),
            level(3, None, "中"),
            level(6, None, "末"),
        ])
        .expect_err("middle open ended");
        assert_invalid_message(err, "只有最后一档可以没有上限");
    }

    #[test]
    fn rejects_negative_min() {
        let err =
            normalize_busy_levels(&request(vec![input(-1, None, "负")])).expect_err("negative min");
        assert_invalid_message(err, "负数");
    }

    #[test]
    fn rejects_max_less_than_min() {
        let err = normalize_busy_levels(&request(vec![input(5, Some(3), "反向")]))
            .expect_err("reverse range");
        assert_invalid_message(err, "最大任务数不能小于最小任务数");
    }

    #[test]
    fn rejects_blank_name_and_message() {
        let err = normalize_busy_levels(&request(vec![SaveBusyLevelInput {
            min_tasks: 0,
            max_tasks: None,
            emoji: "🙂".to_string(),
            name: "   ".to_string(),
            messages: vec!["文案".to_string()],
        }]))
        .expect_err("blank name");
        assert_invalid_message(err, "状态名称不能为空");

        let err = normalize_busy_levels(&request(vec![SaveBusyLevelInput {
            min_tasks: 0,
            max_tasks: None,
            emoji: "🙂".to_string(),
            name: "正常".to_string(),
            messages: vec!["   ".to_string()],
        }]))
        .expect_err("blank message");
        assert_invalid_message(err, "至少保留一条文案");
    }

    #[test]
    fn normalizes_unsorted_input_by_min_tasks() {
        let normalized = normalize_busy_levels(&request(vec![
            input(6, None, "末"),
            input(0, Some(2), "前"),
            input(3, Some(5), "中"),
        ]))
        .expect("normalize");

        assert_eq!(normalized[0].min_tasks, 0);
        assert_eq!(normalized[1].min_tasks, 3);
        assert_eq!(normalized[2].min_tasks, 6);
        validate_busy_level_set(&normalized).expect("sorted valid");
    }

    #[test]
    fn resolver_maps_boundary_counts_for_defaults() {
        let levels: Vec<BusyLevelWriteInput> = DEFAULT_BUSY_LEVELS
            .iter()
            .map(|level| BusyLevelWriteInput {
                min_tasks: level.min_tasks,
                max_tasks: level.max_tasks,
                emoji: level.emoji.to_string(),
                name: level.name.to_string(),
                messages: vec![level.message.to_string()],
            })
            .collect();

        let cases = [
            (0, "空闲"),
            (1, "松弛"),
            (2, "松弛"),
            (3, "正常"),
            (5, "正常"),
            (6, "有点忙"),
            (8, "有点忙"),
            (9, "很忙"),
            (12, "很忙"),
            (13, "爆满"),
            (100, "爆满"),
        ];

        for (task_count, expected_name) in cases {
            let resolved = resolve_busy_level(task_count, &levels).expect("resolved");
            assert_eq!(resolved.name, expected_name, "count {task_count}");
        }
    }

    fn assert_invalid_message(error: AppError, expected_fragment: &str) {
        match error {
            AppError::InvalidTaskInput { message } => {
                assert!(
                    message.contains(expected_fragment),
                    "expected fragment `{expected_fragment}` in `{message}`"
                );
            }
            other => panic!("expected InvalidTaskInput, got {other:?}"),
        }
    }
}
