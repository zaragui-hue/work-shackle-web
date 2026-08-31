# 精神状态事务所 GitHub 官网与桌面发布设计

## 目标

将当前完整项目发布到 `zaragui-hue/work-shackle-web`，使用 GitHub Pages 提供独立项目官网，并通过 GitHub Releases 发布 Windows 与 macOS 安装包。官网介绍 App 功能、使用场景和真实界面，并为两个平台提供清晰的下载入口。

## 仓库与兼容性

- 现有 `work-shackle-web` 仓库升级为完整项目仓库，根目录保存桌面 App、独立浏览器版、官网和自动化工作流。
- 保留 GitHub 仓库名和 Tauri 更新端点，避免自动更新地址迁移。
- 不修改桌面 App 与 `web/` 子项目的业务功能。
- 保留 Tauri identifier、存储键和用户数据格式。

## 官网架构

- 新建独立 `site/` 静态官网，使用原生 HTML、CSS 和少量 JavaScript。
- 官网不导入 `src/` 或 `web/src/`，从而保持与现有业务隔离。
- 所有资源使用相对路径，兼容 `https://zaragui-hue.github.io/work-shackle-web/` 子路径部署。
- GitHub Pages 工作流直接上传 `site/`，不增加官网运行时依赖。

## 视觉与内容

- 延续 App 的国潮卡通、粗描边、黄蓝红高对比配色和轻微错位阴影。
- 页面背景铺满浏览器，不使用深色外围画框；点阵或深色纹理只作为内部区块装饰。
- 首页包含：产品主张、核心功能、典型使用场景、产品截图、平台下载、安装提示与页脚仓库入口。
- 产品截图来自本地真实 App 预览，展示今日状态、任务管理和设置/提醒等代表性界面，不使用虚构界面。
- 桌面和移动宽度均保持清晰可读，下载按钮在窄屏下纵向排列。

## 下载入口

- 官网 JavaScript 请求 GitHub 公共 API 的最新 Release。
- Windows 按钮匹配 `.exe` 安装包，macOS 按钮匹配 `.dmg` 安装包。
- 匹配成功后按钮直接指向对应 Release asset 的下载地址。
- API 请求失败、没有 Release 或缺少目标资源时，按钮退回仓库的 `/releases/latest` 页面并显示明确状态，不阻塞官网其余内容。
- 页面同时展示最新版本号与文件类型，避免用户下载错误平台。

## GitHub Pages

- 根仓库新增 `.github/workflows/pages.yml`。
- `main` 分支更新或手动触发时，工作流上传 `site/` 并部署到 GitHub Pages。
- 工作流使用最小权限：`contents: read`、`pages: write`、`id-token: write`。
- 部署完成后验证 HTTPS、资源加载、响应式布局、控制台错误与下载按钮目标。

## GitHub Releases 与自动更新

- 使用根仓库已有 `.github/workflows/release.yml`，在 `v*` 标签推送时构建 macOS Apple Silicon 和 Windows x64 安装包。
- Release 名称与文案改为「精神状态事务所」，构建继续生成 Tauri updater 的签名与 `latest.json`。
- Tauri updater 私钥只上传到 GitHub Actions Secret `TAURI_SIGNING_PRIVATE_KEY`；私钥文件继续由 `.gitignore` 排除。
- 私钥密码为空时仍保留可选 Secret 字段；不把密钥、密码或令牌写入仓库、日志、官网或 Release 描述。
- 首次正式发布使用当前版本 `v0.1.1`。官网按钮通过最新 Release API 自动跟随未来版本，无需逐次改 URL。

## 敏感信息与仓库卫生

- 推送前检查跟踪文件、未跟踪文件和忽略文件中的密钥、令牌、密码、数据库及本地配置。
- `.gitignore` 至少排除：依赖目录、构建产物、Rust target、SQLite 数据库、日志、`.env*`、Tauri 私钥、编辑器文件和本地发布暂存目录。
- 安装包不直接提交到 Git 历史；由 GitHub Actions 生成并保存到 Releases。
- 本地 `release/` 目录仅作为暂存来源或历史验证材料，不进入仓库。
- 提交前运行差异检查，确认不存在被暂存的私钥、数据库、构建目录或旧安装包。

## 测试与验收

- 运行桌面 App 的完整测试、前端构建和 Rust 编译检查。
- 运行 `web/` 子项目的测试、构建和隔离检查。
- 为官网下载解析逻辑提供可重复测试，覆盖 Windows、macOS 和回退状态。
- 本地启动官网并使用浏览器检查桌面、移动布局和产品截图。
- 推送后等待 Pages 与 Release Actions 成功，并实际访问 Pages URL。
- 验证 Windows/macOS 按钮分别指向最新 Release 中的 `.exe` 与 `.dmg`。

## 发布顺序与失败处理

1. 完成安全检查、官网、工作流和本地验证。
2. 提交完整项目并推送 `main`，等待 Pages 部署。
3. 在用户对私钥上传进行操作时确认后，配置 GitHub Secret。
4. 创建并推送 `v0.1.1` 标签，等待双平台 Release 完成。
5. 验证 `latest.json`、安装包和官网按钮。

如果 Pages 失败，保留已推送源码并修复 Pages 工作流；如果某个平台构建失败，不伪装为完整发布，官网对应按钮保持 Release 页面回退，直到安装包生成成功。任何发布故障都不通过修改业务功能规避。
