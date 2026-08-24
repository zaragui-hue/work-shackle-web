# Work Shackle 视觉与交互重设计实施计划

> 依据：`docs/superpowers/specs/2026-08-21-work-shackle-visual-personality-redesign.md`

## 目标

在不改动现有后端业务模型的前提下，将应用外壳、今日页、任务页、设置页和提醒窗口统一为「严肃排版，内容发疯」的工位生存系统，并接入原创打工马反应素材。

## 实施顺序

### 1. 建立视觉基线

- 更新 `src/styles/tokens.css` 与 `src/styles/base.css`：确定墨黑、纸张、电蓝、荧光绿、警报红、数据字体、硬阴影与圆角。
- 更新共享 `Button`、`Card`、`Input`、`EmptyState`、`Modal`、`Drawer`，统一边框、焦点、加载、禁用与响应式。
- 更新 `AppShell`：刊头、实时状态、页面编号感和底部导航。
- 验证现有组件测试与 TypeScript 构建。

### 2. 今日页核心重排

- 重排 `TodayPage` 四区结构，补充票号与结构性元数据。
- 将 `WorkCountdownBanner` 改造成黑色主舞台，保留既有时间和进度逻辑。
- 将 `WorkdayBrief` 改造成电蓝精神广播卡，并由工作进度映射反应类型。
- 重做 `TodayTaskBoard`、`TodayTaskCard`、`WorkScheduleEditor` 与提醒条的票据/警报层级。
- 补充基于现有状态的确定性文案，不引入随机弹幕。

### 3. 原创打工马反应系统

- 生成透明背景的原创打工马反应素材：职业假笑、缓缓闭眼、瞳孔地震、下班狂奔、加班石化。
- 保存到 `src/assets/mascot/workhorse/reactions/`，并在 `src/assets/mascot` 建立类型化映射。
- 新建共享 `WorkhorseReaction`，接收 reaction、title、description 和 tone。
- 在精神广播、提醒窗口、空状态与关键事件中接入；不替代功能型图标。

### 4. 任务、设置与提醒统一

- `TasksPage`：加入任务页刊头、票号、稳定的分段视图和票据式列表。
- `TaskList`、`TaskCalendar`：统一日期、优先级、忙碌度和逾期层级。
- `SettingsPage` 及各设置 section：改为「工位使用说明」，保持表单标签和保存动作直白。
- `ReminderWindowView`：强化 DDL 逐级警报，接入对应打工马反应。

### 5. 验证

- 更新受文案、结构和素材映射影响的 Vitest 测试。
- 运行 `npm test` 与 `npm run build`。
- 启动本地页面，在桌面、平板和手机宽度检查正常、空、错误、逾期、下班与加班状态。
- 修复溢出、层级、对比度、键盘焦点和 reduced-motion 问题。

## 变更边界

- 不修改 SQLite 表结构和 Rust 业务规则。
- 不删除或覆盖工作区已有的独立改动。
- 不引入在线字体、远程图片、UI 框架或受保护表情包。
- 关键动作继续使用准确动词；自嘲文案只用于标题、说明和状态反馈。
