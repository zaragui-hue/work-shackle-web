# Work Shackle Web

独立维护的电脑浏览器版本。它只实现「今日」页面，不会随桌面 App 自动更新，也不会修改或读取桌面 App 的 SQLite 数据。

Web 的「今日」页面使用与当前桌面 App 一致的视觉与主要交互，但代码和素材均复制在 `web/` 内独立维护。顶部保留「今日、任务、设置」三个入口；任务页和设置页尚未实现，点击时会在今日页显示说明。

## 使用要求

- 使用最新版 Chrome 或 Edge。
- 首次打开时选择一个专门的数据文件夹。
- 主数据保存在 `work-shackle-web.json`，上一版本保存在 `work-shackle-web.backup.json`，每日备份位于 `backups/`。
- 浏览器可能在重新打开后要求再次确认原文件夹。
- 提醒只在页面打开期间运行；浏览器通知需要手动授权。
- 本次 UI 更新不改变 `work-shackle-web.json` 的结构，已有数据文件夹和历史任务可继续使用。

## 开发

```bash
npm install
npm run dev
```

本地开发地址默认为 `http://localhost:1430`。

## 验证

```bash
npm test
npm run build
npm run check:isolation
```

## 在线版本

`main` 分支更新后，GitHub Actions 会先执行测试、隔离检查和生产构建，再发布到仓库的 GitHub Pages 地址。

线上版本和桌面 App 独立维护，不会自动同步桌面端功能。
