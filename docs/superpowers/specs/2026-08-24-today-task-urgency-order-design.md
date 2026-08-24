# 今日待办紧急度排序设计

## 目标

移除“即将到点”独立区块，避免同一任务在“即将到点”和“今天要干”中重复出现；让“今天要干”列表本身按完成紧迫度排序。

## 当前问题

后端会把今天计划或今天截止的未完成任务放入 `formal_tasks`，同时把其中尚未到 DDL 的任务再放入 `upcoming_deadline_tasks`。前端分别渲染这两个集合，导致临近 DDL 的任务重复展示，顶部“今日版面”数量也重复计算。

当前 `formal_tasks` 按计划时间排序，无法保证更快到 DDL 的任务排在前面。

## 方案

采用后端统一排序、前端精简展示的方案。

### 后端排序

保留 `TodayTasksDto` 及 `upcoming_deadline_tasks` 字段，避免扩大 IPC 接口改动。调整 `formal_tasks` 的排序规则：

1. 有 DDL 的任务排在无 DDL 的任务之前。
2. 有 DDL 的任务按 `deadline_at_ms` 升序排列。因此，今天已经过 DDL 的任务自然排在最前，随后是未来 DDL 从近到远。
3. 无 DDL 的任务按 `planned_at_ms` 升序排列。
4. 排序值相同时使用任务 `id` 作为稳定的最终排序键。

人工优先级不参与本次排序，继续作为任务卡片上的提示信息展示。

### 前端展示

- `TodayTaskBoard` 不再渲染“即将到点”区块。
- “今天要干”继续使用 `formalTasks`，直接沿用后端返回的紧急度顺序。
- “历史欠账”和“今天已经搞定”保持现有展示与排序。
- 顶部“今日版面”数量只统计 `formalTasks` 与 `overdueTasks`，不再加上重复的 `upcomingDeadlineTasks`。
- 空状态兼容现有接口；`upcomingDeadlineTasks` 不再单独影响可见内容。

## 数据流

`query_today_tasks` 从数据库读取任务，完成今日分类并对 `formal_tasks` 做紧急度排序；前端收到结果后按返回顺序渲染“今天要干”，不在界面层重复排序或合并数据。

## 测试

后端单元测试覆盖：

- 已过 DDL 的任务排在未来 DDL 任务之前。
- 未来 DDL 越近越靠前。
- 无 DDL 任务排在有 DDL 任务之后，并按计划时间排序。
- 相同排序条件下结果稳定。

前端组件测试覆盖：

- 不再出现“即将到点”标题。
- 原本属于 `upcomingDeadlineTasks` 的数据不会被单独重复渲染。
- “今天要干”按 `formalTasks` 的返回顺序展示。
- 顶部数量不再重复统计 `upcomingDeadlineTasks`。

## 非目标

- 不删除后端 `upcoming_deadline_tasks` 字段。
- 不改变“历史欠账”与“已完成”任务的分类规则。
- 不改变任务优先级的含义或编辑方式。
- 不调整 DDL 提醒通知逻辑。
