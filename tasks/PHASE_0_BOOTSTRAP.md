# Phase 0 首批任务

不要同时执行。严格按顺序。

---

# TASK-0001：初始化 Tauri + React + TypeScript 项目

## 目标

只创建可以运行的 Work Shackle 桌面工程骨架。

## 允许修改

项目初始化生成文件。

## 禁止

- 业务功能；
- SQLite；
- 任务管理；
- 日历；
- 提醒；
- 加班；
- UI 大规模设计。

## 验收

- `npm install` 成功；
- `npm run tauri dev` 成功；
- macOS 出现桌面窗口；
- 窗口显示 Work Shackle；
- 无阻塞错误。

---

# TASK-0002：落地 docs、Rules 与 ignore

## 目标

将 Engineering Pack 中：

```text
docs/
.cursor/rules/
.cursorignore
```

放入项目。

## 验收

- Cursor Customize/Rules 中能看到项目 Rules；
- `docs/PRD.md` 存在；
- 不修改业务代码。

---

# TASK-0003：安装 V1 最小依赖

## 前端

```text
date-fns
react-hook-form
zod
lucide-react
```

## Rust/Tauri

```text
rusqlite
chrono
serde
serde_json
notification plugin
dialog plugin
single-instance plugin
```

## 验收

- `npm run tauri dev` 仍成功；
- `cargo check` 成功；
- 没有新增其他状态管理、UI、数据库框架。

---

完成 TASK-0001～0003 后，再开始 Phase 1。
