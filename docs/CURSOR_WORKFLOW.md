# Work Shackle Cursor 工作流与省 Token 策略

> 当前策略目标：优先使用 Cursor 自有/Auto 额度完成日常编码，把第三方高价模型留给真正困难的问题。

---

# 1. 模型使用策略

截至本工程文档生成时，Cursor Pro 的模型使用存在 Cursor Models 与 Other Models 两类额度。Work Shackle 开发按下面方式使用。

## 默认：Auto（Optimize for Cost）

用于约 70%–80% 的任务：

- 单组件开发；
- CRUD；
- CSS；
- 表单；
- 简单 Rust command；
- 单元测试；
- 小 Bug；
- 文案配置；
- 目录整理。

不要为了“可能更聪明”默认选择高价模型。

## Composer 2.5 Fast

用于：

- 快速 UI 迭代；
- 一次范围很小的跨 2–4 文件修改；
- Auto 输出反复不稳定时。

它属于 Cursor 自有模型池，更适合作为日常备选。

## Sonnet 5 High

只用于：

- Tauri / Rust / React 边界 Bug；
- 多模块集成问题；
- 难以复现的生命周期问题；
- 数据迁移 review。

每次必须给明确文件范围。

## GPT-5.6 Sol Medium

只用于：

- 复杂架构判断；
- 时间/提醒状态机严重 Bug；
- release blocker；
- 当 Auto / Composer / Sonnet 已无法可靠解决时。

不要让它读取整个仓库做常规 CRUD。

## Opus 5 High

V1 原则上不用。

仅在：

- 发布前发现高风险难题；
- 其他模型连续失败；

时使用一次定向诊断。

---

# 2. 一次只开一个 TASK

错误做法：

```text
请阅读 PRD，把 Work Shackle 全部开发出来。
```

禁止。

正确做法：

```text
实现 TASK-0303：新建任务 Modal。

请先阅读：
@tasks/TASK-0303.md
@docs/ARCHITECTURE.md 中与 Task IPC 有关的章节

只检查以下目录：
@src/features/tasks
@src/services/tauri/tasks.ts

不要修改：
- calendar
- overtime
- reminder engine
- database schema（除非 TASK 明确要求）

完成后运行本 TASK 的测试，并列出修改文件。
```

---

# 3. 新 Chat 策略

推荐：

> 一个 TASK 一个新 Agent Chat。

原因：

- 避免上下文越来越长；
- 避免模型继续沿用上个 TASK 的错误假设；
- Project Rules 会重新提供稳定约束；
- TASK 文件承担任务记忆，而不是聊天历史。

一个复杂 TASK 可以保持一个 chat 到完成，不要一个 TASK 中频繁换模型。

---

# 4. 不要每次 @PRD 全文

PRD 很长。

日常开发不应该每个 TASK 都让模型读取整份 PRD。

TASK 文件应自己写明：

```text
PRD 依据：
- 10. 新建任务
- 11. 紧急程度
- 13. 对接人
- 14. 用户自定义提醒
```

只有出现产品歧义时再打开对应 PRD 小节。

---

# 5. Cursor Rules 保持短

本项目使用：

```text
.cursor/rules/
```

规则拆分而不是一个 1000 行大 Rule。

核心 Always Apply 规则只包含：

- 不扩大范围；
- 不做 V1 禁止项；
- 一次一个 TASK；
- 数据安全；
- 不擅自换技术栈。

Frontend / Rust / DB / UI 规则按 globs 自动附加。

---

# 6. TASK Prompt 固定格式

每次 Prompt 建议只有五段：

```text
目标：
实现 TASK-XXXX。

允许修改：
...

禁止修改：
...

验收：
...

执行要求：
先检查相关文件；若预计修改范围超出 TASK，先停止并说明，不要自行扩范围。
```

不要把 PRD 全部复制进 Prompt。

---

# 7. 什么时候使用 Plan Mode

使用 Plan Mode：

- 数据库 migration；
- reminder engine；
- 05:00 overtime；
- workspace migration；
- 跨平台 native behavior；
- 超过 4 个模块的 Bug。

不需要 Plan Mode：

- 改一句文案；
- 新增一个按钮；
- CSS 微调；
- 单个表单校验；
- 组件小 Bug。

Plan 只要求：

```text
列出会修改的文件
说明数据流
列出测试
```

不要让模型写长篇“行业分析”。

---

# 8. Diff 上限

每个 TASK 开始前要求模型估算：

```text
预计新增/修改文件：
预计代码量：
```

如果：

- 主要文件 > 8；
- 单次 diff > 500–700 行；
- 同时修改 DB + UI + scheduler；

通常应该拆 TASK。

初始化脚手架任务例外。

---

# 9. 不允许 Agent 自行做的事

除非 TASK 明确要求：

- 不升级所有依赖；
- 不换 Tauri/Electron；
- 不引入 Redux；
- 不引入 Tailwind/shadcn；
- 不引入云服务；
- 不加 AI；
- 不加登录；
- 不做 telemetry；
- 不删除 migration；
- 不删除用户 DB；
- 不自动清理旧 workspace；
- 不重构无关目录。

---

# 10. Debug Prompt 模板

不要说：

```text
为什么不行？帮我修。
```

使用：

```text
TASK-0606 出现 Bug。

现象：
...

预期：
...

复现步骤：
1.
2.
3.

终端错误：
...

本次只允许检查：
@src-tauri/src/services/reminder_engine.rs
@src-tauri/src/commands/reminders.rs
@src/services/tauri/reminders.ts

先定位根因，不要先重构。
给出最小修复后执行对应测试。
```

这样会显著减少模型搜索无关代码。

---

# 11. UI Prompt 模板

```text
只调整 TASK-0903 的视觉，不改业务逻辑。

视觉依据：
- 麻纸米白 #F1ECE0
- 草木深绿 #117C0D
- 麦秆暖黄 #FAC75E
- 国潮治愈卡通
- 圆润、低压力、手作感

只修改：
@src/features/reminders/**
@src/styles/animations.css

禁止：
- 改 Rust
- 改 DB
- 引入新动画库
```

---

# 12. 每个 TASK 结束必须让 Cursor 输出

只需要：

```text
1. 修改文件
2. 实现内容
3. 已运行测试
4. 未解决问题
```

不要让 Agent 再写一篇长总结。

---

# 13. 建议的 Cursor 使用比例

这是成本控制目标，不是硬规则：

```text
Auto Cost            70%+
Composer 2.5 Fast    20%左右
Sonnet 5 High        <10%
GPT-5.6 Sol Medium   极少
Opus 5 High          接近 0
```

如果 Auto 已经能正确完成任务，不要为了“保险”再让高价模型重复 review 一遍。

---

# 14. 最重要的省 Token 原则

> 用文件保存上下文，不用聊天保存上下文。

工程决策写进：

```text
docs/
.cursor/rules/
tasks/
```

不要依赖：

> “你还记得前面我跟你说的吗？”

这样每个新 Chat 都只需要读取很小的任务上下文。
