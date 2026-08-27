# Work Shackle Web

独立维护的电脑浏览器版本。它只实现「今日」页面，不会随桌面 App 自动更新，也不会修改或读取桌面 App 的 SQLite 数据。

## 使用要求

- 使用最新版 Chrome 或 Edge。
- 首次打开时选择一个专门的数据文件夹。
- 主数据保存在 `work-shackle-web.json`，上一版本保存在 `work-shackle-web.backup.json`，每日备份位于 `backups/`。
- 浏览器可能在重新打开后要求再次确认原文件夹。
- 提醒只在页面打开期间运行；浏览器通知需要手动授权。

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
