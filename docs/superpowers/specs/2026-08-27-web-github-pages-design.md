# Web GitHub Pages 发布设计

## 目标

将当前仓库中的 `web/` 子项目单独发布到用户 GitHub 账号下的公开仓库 `work-shackle-web`，并通过 GitHub Pages 生成可访问网址。

## 仓库边界

- 新 GitHub 仓库只包含当前 `web/` 目录中的内容。
- 不上传桌面 App 的 `src/`、`src-tauri/`、项目根配置或桌面端历史。
- 当前工作仓库仍保留 `web/` 作为独立子项目。
- 未来只在用户明确要求发布 Web 更新时，才将 `web/` 的新提交同步到公开仓库。

## 发布方式

- 在 `web/.github/workflows/pages.yml` 中添加 GitHub Pages 自动发布工作流。
- 工作流在公开仓库的 `main` 分支更新时执行 `npm ci`、测试、构建和 Pages 部署。
- Vite 在生产构建中使用 `/work-shackle-web/` 作为资源基础路径，本地开发仍使用 `/`。
- 使用 Git subtree 从当前仓库的 `web/` 生成独立历史并推送到新仓库 `main`，避免复制桌面 App 代码。

## 验证与失败处理

- 本地先运行 Web 测试、隔离检查和生产构建。
- 推送后检查 GitHub Actions 的 Pages 工作流状态。
- 部署成功后访问公开 URL，验证页面能加载、资源路径正确，并确认使用 HTTPS。
- 如 GitHub Pages 未自动启用，在新仓库设置中将 Pages 来源设为 GitHub Actions，然后重新运行工作流。
- 任何发布失败都不修改桌面 App 代码或数据。

## 预期结果

- GitHub 仓库：`https://github.com/<username>/work-shackle-web`
- Web 网址：`https://<username>.github.io/work-shackle-web/`
