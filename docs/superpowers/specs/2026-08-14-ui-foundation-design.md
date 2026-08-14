# Work Shackle UI Foundation 设计

> 状态：已评审（对话确认 §1–§3）  
> 日期：2026-08-14  
> 范围：仅前端视觉基建，不开发业务

## 1. 目标

建立 V1 视觉地基：**国潮治愈卡通 × 当代打工人 Meme**。

气质关键词：圆润、松弛、轻量、生活感、手作感、治愈、卡通。

明确禁止：企业后台感、科技蓝、Jira / OA 风格。

本 TASK 只交付：

1. Design Tokens  
2. 字体体系  
3. spacing  
4. 圆角  
5. shadow  
6. Card  
7. Button  
8. Modal  
9. Drawer  
10. Empty State  
11. App Shell  
12. 今日 / 任务 / 设置三个导航空页面  

角色仅用简单原创 SVG 占位图形，不生成完整表情包体系。

## 2. 已确认决策

| 项 | 选择 |
|---|---|
| 启动与 Shell | **A**：启动成功后进入 App Shell；启动中/失败保留 StartupPanel，套新 tokens |
| 导航 | **A**：底部三栏 Tab（今日 / 任务 / 设置） |
| 字体 | **A**：系统圆角无衬线栈，零字体文件依赖 |
| 实现路径 | **方案 1**：CSS Variables + 轻量共享组件；不引入 Tailwind / Router / UI 框架 |

## 3. Design Tokens

统一文件：`src/styles/tokens.css`

### 3.1 颜色

| Token | 值 | 用途 |
|---|---|---|
| `--color-paper` | `#F1ECE0` | 主背景、壳层底色、卡片外围 |
| `--color-green` | `#117C0D` | 品牌主色、主按钮、导航选中、重点字 |
| `--color-wheat` | `#FAC75E` | 辅助强调、标签、局部高亮、装饰 |
| `--color-ink` | `#3D2B1F` | 正文与柔和描边（不用纯黑） |
| `--color-ink-muted` | `#7A6555` | 次要文案、未选中导航 |
| `--color-danger` | `#C45C4A` | 仅错误/危险（偏陶土红，不进主调盘） |

不允许业务组件硬编码散落十几套颜色。本 TASK 不扩展额外品牌色。

### 3.2 字体

```text
PingFang SC, "Hiragino Sans GB", "Segoe UI", system-ui, sans-serif
```

字阶三档：标题 / 正文 / 辅助。不上在线字体、CDN。

### 3.3 Spacing / 圆角 / Shadow

- Spacing：4 的倍数（8 / 12 / 16 / 24 / 32）
- 圆角：卡片约 20–28px；按钮偏 pill；整体圆润
- Shadow：极软暖色弥散；可用厚暖褐描边代替重阴影
- 纹理：极淡纸感（CSS noise / 渐变），不得影响可读性

## 4. 文件结构

```text
src/styles/tokens.css
src/styles/base.css
src/shared/ui/
  Button.tsx + Button.css
  Card.tsx + Card.css
  Modal.tsx + Modal.css
  Drawer.tsx + Drawer.css
  EmptyState.tsx + EmptyState.css
src/shared/shell/
  AppShell.tsx + AppShell.css
src/assets/mascot/placeholder.svg
src/pages/
  TodayPage.tsx
  TasksPage.tsx
  SettingsPage.tsx
  StartupPanel.tsx
```

`App.tsx`：保留现有启动逻辑；`ready` 后渲染 `AppShell`，否则渲染 `StartupPanel`。

## 5. 组件规格

### Button

- `primary`：草木深绿底 + 浅色字  
- `secondary`：纸色底 + 绿描边  
- `wheat`：麦秆暖黄点缀（次强调）  
- 大圆角；无科技蓝  

### Card

- 纸色填充、暖褐柔边、大圆角  
- 可选标题区使用麦秆暖黄条  

### Modal

- 居中遮罩 + 圆角面板  
- 设置页提供「确认 / 取消」演示开关，无业务逻辑  

### Drawer

- 自右侧滑入  
- 设置页提供演示开关，无业务逻辑  

### Empty State

- 原创占位角色 + 一句打工 Meme 短文案 + 可选 CTA 位（不接业务）  

## 6. App Shell 流程

```text
启动中 / 失败 → StartupPanel（新视觉）
启动成功     → AppShell
                ├─ 今日（默认）
                ├─ 任务
                └─ 设置
```

- 底部 Tab：选中草木深绿，未选中暖褐淡色  
- 三页均为空壳：各放 1 个 Card + Empty State  
- 设置页额外挂 Modal / Drawer 演示按钮，仅供视觉验收  

导航用 React 本地 state，不引入 React Router。

## 7. 范围边界

### 做

- 上述 tokens、组件、Shell、三空页、启动换肤  
- 1 个原创 SVG 占位角色  
- 实际运行 App；能截图则视觉自检  

### 不做

- 任务 CRUD、日历、计时、加班等业务  
- Rust / SQLite / migration / Reminder / Overtime  
- 完整表情包 / Meme 体系  
- React Router、Tailwind、shadcn、大型动画库  
- 在线字体 / CDN 素材  

## 8. 验收标准

1. 启动成功后可切换「今日 / 任务 / 设置」  
2. 主色仅为麻纸米白 / 草木深绿 / 麦秆暖黄 + 暖褐墨色；无科技蓝  
3. 界面圆润、留白松，不似 OA / Jira  
4. 设置页可开关 Modal / Drawer  
5. Empty State 含占位角色与短文案  
6. 前端 `npm run build` 通过；Tauri 可打开看界面  

## 9. 测试

- 跑 Tauri / Vite 看真实窗口  
- 有截图能力则截三 Tab + Modal / Drawer  
- 本 TASK 不写业务单元测试  

## 10. 参考

- `docs/PRD.md` §27 视觉风格  
- `docs/ARCHITECTURE.md` §13 UI 与资源  
- 用户提供的配色与治愈卡通参考图（气质参考，不复制受保护 IP）  
