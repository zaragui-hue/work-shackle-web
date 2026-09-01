# 精神状态事务所

一个有点嘴欠、但真的能帮你下班的桌面任务管理工具。

[产品官网](https://zaragui-hue.github.io/work-shackle-web/) · [下载安装](https://github.com/zaragui-hue/work-shackle-web/releases) · [提交问题](https://github.com/zaragui-hue/work-shackle-web/issues)

## 能做什么

- 用下班倒计时看清今天还剩多少班味
- 根据 DDL 和紧急程度整理今天的任务
- 把真正超过截止日的未完成任务移入“昨日烂尾”
- 让无 DDL 或仍在有效期内的跨天任务继续留在今日待办
- 用进行中、暂停、等别人、已完成、已取消描述真实工作状态
- 根据早晚、加班和 DDL 状态切换应用图标
- 数据保存在本地，无需注册账号

## 支持平台

- macOS（Apple Silicon）
- Windows（x64）

安装包与版本记录统一发布在 [GitHub Releases](https://github.com/zaragui-hue/work-shackle-web/releases)。

## 本地开发

```bash
npm install
npm run dev
```

运行桌面应用：

```bash
npm run tauri dev
```

运行测试与构建：

```bash
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

## 产品官网

官网源码位于 `site/`，由 `.github/workflows/pages.yml` 自动部署到 GitHub Pages。
