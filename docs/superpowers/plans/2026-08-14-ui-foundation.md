# Work Shackle UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立国潮治愈卡通视觉地基：Design Tokens、基础组件、App Shell，以及今日/任务/设置三个导航空页面。

**Architecture:** CSS Variables 集中在 `src/styles/tokens.css`；共享 UI 组件放在 `src/shared/ui`；壳层在 `src/shared/shell`；页面在 `src/pages`。启动成功后用本地 state 切换底部 Tab，不引入 Router / Tailwind / UI 框架。保留现有 Tauri 启动逻辑，不改 Rust。

**Tech Stack:** Tauri 2、React 19、TypeScript、Vite、纯 CSS（CSS Variables）

## Global Constraints

- 主色仅：`--color-paper #F1ECE0`、`--color-green #117C0D`、`--color-wheat #FAC75E`，辅以 `--color-ink #3D2B1F`、`--color-ink-muted #7A6555`、`--color-danger #C45C4A`。
- 视觉：圆润、松弛、轻量、生活感、手作感、治愈、卡通；禁止科技蓝、Jira/OA 后台感。
- 不修改 Rust、SQLite、migration、Reminder、Overtime。
- 不引入 React Router、Tailwind、shadcn、Framer Motion、在线字体/CDN。
- 角色仅 1 个原创 SVG 占位；不做完整表情包体系。
- 不开发业务（任务 CRUD、日历、计时等）。
- 不提交 git commit，除非用户另行明确要求。
- 验证以 `npm run build` + 实际跑 App / 截图自检为准；本 TASK 不写业务单测。

---

### Task 1: Design Tokens + Base Styles

**Files:**
- Create: `src/styles/tokens.css`
- Create: `src/styles/base.css`
- Modify: `src/main.tsx`
- Modify: `src/App.css`（精简为仅保留必要时可删除全局冲突样式，或改为空壳由 base 接管）

**Interfaces:**
- Produces: CSS custom properties listed below (consumed by all later UI)
- Produces: global paper background + font stack on `html, body, #root`

- [ ] **Step 1: Create `src/styles/tokens.css`**

```css
:root {
  --color-paper: #f1ece0;
  --color-green: #117c0d;
  --color-wheat: #fac75e;
  --color-ink: #3d2b1f;
  --color-ink-muted: #7a6555;
  --color-danger: #c45c4a;
  --color-paper-raised: #f7f3ea;
  --color-overlay: rgba(61, 43, 31, 0.35);

  --font-family: "PingFang SC", "Hiragino Sans GB", "Segoe UI", system-ui,
    sans-serif;
  --font-size-title: 1.5rem;
  --font-size-body: 1rem;
  --font-size-caption: 0.875rem;
  --line-height-body: 1.55;
  --font-weight-regular: 400;
  --font-weight-medium: 600;

  --space-1: 8px;
  --space-2: 12px;
  --space-3: 16px;
  --space-4: 24px;
  --space-5: 32px;

  --radius-card: 24px;
  --radius-button: 999px;
  --radius-panel: 28px;

  --shadow-soft: 0 8px 24px rgba(61, 43, 31, 0.08);
  --shadow-lift: 0 4px 12px rgba(61, 43, 31, 0.1);
  --border-ink: 2px solid rgba(61, 43, 31, 0.18);
  --border-green: 2px solid var(--color-green);
}
```

- [ ] **Step 2: Create `src/styles/base.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  min-height: 100%;
}

body {
  font-family: var(--font-family);
  font-size: var(--font-size-body);
  line-height: var(--line-height-body);
  color: var(--color-ink);
  background-color: var(--color-paper);
  background-image:
    radial-gradient(rgba(61, 43, 31, 0.035) 0.6px, transparent 0.6px),
    linear-gradient(180deg, #f4efe4 0%, var(--color-paper) 48%, #ebe4d6 100%);
  background-size: 6px 6px, auto;
  -webkit-font-smoothing: antialiased;
}

button,
input,
textarea {
  font: inherit;
  color: inherit;
}

button {
  cursor: pointer;
}

h1,
h2,
h3,
p {
  margin: 0;
}

:focus-visible {
  outline: 3px solid var(--color-wheat);
  outline-offset: 2px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 3: Wire styles in `src/main.tsx`**

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/tokens.css";
import "./styles/base.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 4: Strip conflicting global styles from `src/App.css`**

Replace contents with a short comment-only or minimal file so startup/shell own their CSS:

```css
/* App-level layout lives in pages/shell components. */
```

- [ ] **Step 5: Verify TypeScript/CSS import compiles**

Run: `npm run build`  
Expected: PASS（或仅有与本 TASK 无关的既有错误；tokens/base 不得导致失败）

---

### Task 2: Placeholder Mascot + Core UI Primitives (Button, Card)

**Files:**
- Create: `src/assets/mascot/placeholder.svg`
- Create: `src/shared/ui/Button.tsx`
- Create: `src/shared/ui/Button.css`
- Create: `src/shared/ui/Card.tsx`
- Create: `src/shared/ui/Card.css`
- Create: `src/shared/ui/index.ts`

**Interfaces:**
- Consumes: tokens from Task 1
- Produces: `Button({ variant?: "primary" | "secondary" | "wheat"; type?; disabled?; onClick?; children; className? })`
- Produces: `Card({ title?: string; children; className?; headerAccent?: boolean })`
- Produces: barrel export from `src/shared/ui/index.ts`

- [ ] **Step 1: Create original placeholder mascot SVG**

`src/assets/mascot/placeholder.svg` — simple round-headed creature (not any known IP):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <circle cx="60" cy="62" r="40" fill="#F7F3EA" stroke="#3D2B1F" stroke-width="3"/>
  <circle cx="46" cy="58" r="5" fill="#3D2B1F"/>
  <circle cx="74" cy="58" r="5" fill="#3D2B1F"/>
  <path d="M48 76c6 8 18 8 24 0" stroke="#3D2B1F" stroke-width="3" stroke-linecap="round"/>
  <ellipse cx="36" cy="70" rx="6" ry="4" fill="#FAC75E" opacity="0.7"/>
  <ellipse cx="84" cy="70" rx="6" ry="4" fill="#FAC75E" opacity="0.7"/>
  <path d="M40 34c6-14 34-14 40 0" stroke="#117C0D" stroke-width="4" stroke-linecap="round"/>
</svg>
```

- [ ] **Step 2: Implement Button**

`Button.tsx`:

```tsx
import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

export type ButtonVariant = "primary" | "secondary" | "wheat";

type ButtonProps = {
  variant?: ButtonVariant;
  children: ReactNode;
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  children,
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`ws-button ws-button--${variant} ${className}`.trim()}
      {...rest}
    >
      {children}
    </button>
  );
}
```

`Button.css`:

```css
.ws-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-1);
  min-height: 44px;
  padding: 10px 22px;
  border-radius: var(--radius-button);
  border: var(--border-ink);
  font-weight: var(--font-weight-medium);
  box-shadow: var(--shadow-lift);
  transition: transform 120ms ease, box-shadow 120ms ease;
}

.ws-button:hover:not(:disabled) {
  transform: translateY(-1px);
}

.ws-button:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: none;
}

.ws-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.ws-button--primary {
  background: var(--color-green);
  color: #f8f5ee;
  border-color: transparent;
}

.ws-button--secondary {
  background: var(--color-paper-raised);
  color: var(--color-green);
  border: var(--border-green);
}

.ws-button--wheat {
  background: var(--color-wheat);
  color: var(--color-ink);
  border-color: transparent;
}
```

- [ ] **Step 3: Implement Card**

`Card.tsx`:

```tsx
import type { ReactNode } from "react";
import "./Card.css";

type CardProps = {
  title?: string;
  headerAccent?: boolean;
  children: ReactNode;
  className?: string;
};

export function Card({
  title,
  headerAccent = false,
  children,
  className = "",
}: CardProps) {
  return (
    <section className={`ws-card ${className}`.trim()}>
      {title ? (
        <header
          className={`ws-card__header${headerAccent ? " ws-card__header--accent" : ""}`}
        >
          <h2 className="ws-card__title">{title}</h2>
        </header>
      ) : null}
      <div className="ws-card__body">{children}</div>
    </section>
  );
}
```

`Card.css`:

```css
.ws-card {
  background: var(--color-paper-raised);
  border: var(--border-ink);
  border-radius: var(--radius-card);
  box-shadow: var(--shadow-soft);
  overflow: hidden;
}

.ws-card__header {
  padding: var(--space-3) var(--space-4);
  border-bottom: 1px solid rgba(61, 43, 31, 0.12);
}

.ws-card__header--accent {
  background: var(--color-wheat);
}

.ws-card__title {
  font-size: var(--font-size-title);
  font-weight: var(--font-weight-medium);
  color: var(--color-ink);
}

.ws-card__body {
  padding: var(--space-4);
}
```

- [ ] **Step 4: Barrel export**

`src/shared/ui/index.ts`:

```ts
export { Button } from "./Button";
export type { ButtonVariant } from "./Button";
export { Card } from "./Card";
```

- [ ] **Step 5: Verify build**

Run: `npm run build`  
Expected: PASS

---

### Task 3: Modal, Drawer, EmptyState

**Files:**
- Create: `src/shared/ui/Modal.tsx`
- Create: `src/shared/ui/Modal.css`
- Create: `src/shared/ui/Drawer.tsx`
- Create: `src/shared/ui/Drawer.css`
- Create: `src/shared/ui/EmptyState.tsx`
- Create: `src/shared/ui/EmptyState.css`
- Modify: `src/shared/ui/index.ts`

**Interfaces:**
- Consumes: `Button` from Task 2; mascot SVG
- Produces: `Modal({ open: boolean; title: string; onClose: () => void; children; footer? })`
- Produces: `Drawer({ open: boolean; title: string; onClose: () => void; children })`
- Produces: `EmptyState({ title: string; description: string; action? })`

- [ ] **Step 1: Implement Modal**

`Modal.tsx`:

```tsx
import type { ReactNode } from "react";
import { useEffect } from "react";
import "./Modal.css";

type ModalProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
};

export function Modal({ open, title, onClose, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="ws-modal" role="presentation">
      <button
        type="button"
        className="ws-modal__backdrop"
        aria-label="关闭弹层"
        onClick={onClose}
      />
      <div
        className="ws-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-modal-title"
      >
        <header className="ws-modal__header">
          <h2 id="ws-modal-title">{title}</h2>
        </header>
        <div className="ws-modal__body">{children}</div>
        {footer ? <footer className="ws-modal__footer">{footer}</footer> : null}
      </div>
    </div>
  );
}
```

`Modal.css`:

```css
.ws-modal {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: grid;
  place-items: center;
  padding: var(--space-4);
}

.ws-modal__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: var(--color-overlay);
  cursor: pointer;
}

.ws-modal__panel {
  position: relative;
  width: min(100%, 420px);
  background: var(--color-paper-raised);
  border: var(--border-ink);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-soft);
  padding: var(--space-4);
}

.ws-modal__header h2 {
  font-size: var(--font-size-title);
}

.ws-modal__body {
  margin-top: var(--space-3);
  color: var(--color-ink-muted);
}

.ws-modal__footer {
  margin-top: var(--space-4);
  display: flex;
  justify-content: flex-end;
  gap: var(--space-2);
}
```

- [ ] **Step 2: Implement Drawer**

`Drawer.tsx`:

```tsx
import type { ReactNode } from "react";
import { useEffect } from "react";
import "./Drawer.css";

type DrawerProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
};

export function Drawer({ open, title, onClose, children }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      className={`ws-drawer${open ? " ws-drawer--open" : ""}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className="ws-drawer__backdrop"
        aria-label="关闭抽屉"
        onClick={onClose}
        tabIndex={open ? 0 : -1}
      />
      <aside
        className="ws-drawer__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ws-drawer-title"
      >
        <header className="ws-drawer__header">
          <h2 id="ws-drawer-title">{title}</h2>
          <button type="button" className="ws-drawer__close" onClick={onClose}>
            关闭
          </button>
        </header>
        <div className="ws-drawer__body">{children}</div>
      </aside>
    </div>
  );
}
```

`Drawer.css`:

```css
.ws-drawer {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.ws-drawer--open {
  pointer-events: auto;
}

.ws-drawer__backdrop {
  position: absolute;
  inset: 0;
  border: 0;
  background: var(--color-overlay);
  opacity: 0;
  transition: opacity 180ms ease;
}

.ws-drawer--open .ws-drawer__backdrop {
  opacity: 1;
}

.ws-drawer__panel {
  position: absolute;
  top: 0;
  right: 0;
  height: 100%;
  width: min(100%, 360px);
  background: var(--color-paper-raised);
  border-left: var(--border-ink);
  box-shadow: var(--shadow-soft);
  transform: translateX(100%);
  transition: transform 200ms ease;
  padding: var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  border-radius: var(--radius-panel) 0 0 var(--radius-panel);
}

.ws-drawer--open .ws-drawer__panel {
  transform: translateX(0);
}

.ws-drawer__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
}

.ws-drawer__header h2 {
  font-size: var(--font-size-title);
}

.ws-drawer__close {
  background: transparent;
  border: var(--border-ink);
  border-radius: var(--radius-button);
  padding: 6px 14px;
  color: var(--color-ink-muted);
}

.ws-drawer__body {
  color: var(--color-ink-muted);
  flex: 1;
}
```

- [ ] **Step 3: Implement EmptyState**

`EmptyState.tsx`:

```tsx
import type { ReactNode } from "react";
import mascotUrl from "../../assets/mascot/placeholder.svg";
import "./EmptyState.css";

type EmptyStateProps = {
  title: string;
  description: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="ws-empty">
      <img
        className="ws-empty__mascot"
        src={mascotUrl}
        alt=""
        width={96}
        height={96}
      />
      <h3 className="ws-empty__title">{title}</h3>
      <p className="ws-empty__desc">{description}</p>
      {action ? <div className="ws-empty__action">{action}</div> : null}
    </div>
  );
}
```

`EmptyState.css`:

```css
.ws-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: var(--space-2);
  padding: var(--space-4) var(--space-3);
}

.ws-empty__mascot {
  display: block;
}

.ws-empty__title {
  font-size: 1.125rem;
  font-weight: var(--font-weight-medium);
  color: var(--color-ink);
}

.ws-empty__desc {
  max-width: 22rem;
  color: var(--color-ink-muted);
  font-size: var(--font-size-caption);
}

.ws-empty__action {
  margin-top: var(--space-2);
}
```

- [ ] **Step 4: Update barrel**

```ts
export { Button } from "./Button";
export type { ButtonVariant } from "./Button";
export { Card } from "./Card";
export { Modal } from "./Modal";
export { Drawer } from "./Drawer";
export { EmptyState } from "./EmptyState";
```

- [ ] **Step 5: Verify build**

Run: `npm run build`  
Expected: PASS（含 SVG 模块解析；若缺类型，在 `src/vite-env.d.ts` 确保有 `*.svg` 声明）

若缺声明，追加到 `src/vite-env.d.ts`：

```ts
declare module "*.svg" {
  const src: string;
  export default src;
}
```

---

### Task 4: App Shell + Three Empty Pages + StartupPanel

**Files:**
- Create: `src/shared/shell/AppShell.tsx`
- Create: `src/shared/shell/AppShell.css`
- Create: `src/pages/TodayPage.tsx`
- Create: `src/pages/TasksPage.tsx`
- Create: `src/pages/SettingsPage.tsx`
- Create: `src/pages/StartupPanel.tsx`
- Create: `src/pages/StartupPanel.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: Card, Button, Modal, Drawer, EmptyState; existing `initializeApp` / `mapStartupError`
- Produces: `AppShell()` with tabs `"today" | "tasks" | "settings"`
- Produces: `StartupPanel({ viewState; message; workspacePath })`

- [ ] **Step 1: Create page shells**

`TodayPage.tsx`:

```tsx
import { Card, EmptyState } from "../shared/ui";

export function TodayPage() {
  return (
    <Card title="今日" headerAccent>
      <EmptyState
        title="今天还没安排"
        description="班味暂未加载。先喝口水，业务页面稍后接上。"
      />
    </Card>
  );
}
```

`TasksPage.tsx`:

```tsx
import { Card, EmptyState } from "../shared/ui";

export function TasksPage() {
  return (
    <Card title="任务" headerAccent>
      <EmptyState
        title="任务清单空空"
        description="暂时没有砖可搬。Foundation 先把壳搭好。"
      />
    </Card>
  );
}
```

`SettingsPage.tsx`（含 Modal/Drawer 演示）：

```tsx
import { useState } from "react";
import { Button, Card, Drawer, EmptyState, Modal } from "../shared/ui";

export function SettingsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <Card title="设置" headerAccent>
        <EmptyState
          title="设置还在午睡"
          description="这里先用来验收组件。点下面按钮看看弹层手感。"
          action={
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
              <Button variant="primary" onClick={() => setModalOpen(true)}>
                打开 Modal
              </Button>
              <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                打开 Drawer
              </Button>
            </div>
          }
        />
      </Card>

      <Modal
        open={modalOpen}
        title="提示信息"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              取消
            </Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>
              确认
            </Button>
          </>
        }
      >
        <p>这是视觉验收用的 Modal，没有业务逻辑。</p>
      </Modal>

      <Drawer
        open={drawerOpen}
        title="侧栏抽屉"
        onClose={() => setDrawerOpen(false)}
      >
        <p>这是从右侧滑入的 Drawer，用于验收圆角与纸感面板。</p>
      </Drawer>
    </>
  );
}
```

- [ ] **Step 2: Implement AppShell**

`AppShell.tsx`:

```tsx
import { useState } from "react";
import { TodayPage } from "../../pages/TodayPage";
import { TasksPage } from "../../pages/TasksPage";
import { SettingsPage } from "../../pages/SettingsPage";
import "./AppShell.css";

type TabId = "today" | "tasks" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "tasks", label: "任务" },
  { id: "settings", label: "设置" },
];

export function AppShell() {
  const [tab, setTab] = useState<TabId>("today");

  return (
    <div className="ws-shell">
      <header className="ws-shell__brand">
        <p className="ws-shell__eyebrow">Work Shackle</p>
        <h1 className="ws-shell__heading">慢慢搬砖，也要好好喘气</h1>
      </header>

      <main className="ws-shell__content" aria-live="polite">
        {tab === "today" ? <TodayPage /> : null}
        {tab === "tasks" ? <TasksPage /> : null}
        {tab === "settings" ? <SettingsPage /> : null}
      </main>

      <nav className="ws-shell__nav" aria-label="主导航">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`ws-shell__tab${tab === item.id ? " ws-shell__tab--active" : ""}`}
            aria-current={tab === item.id ? "page" : undefined}
            onClick={() => setTab(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
}
```

`AppShell.css`:

```css
.ws-shell {
  min-height: 100vh;
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: var(--space-4) var(--space-4) calc(var(--space-4) + 72px);
  max-width: 720px;
  margin: 0 auto;
}

.ws-shell__brand {
  margin-bottom: var(--space-4);
}

.ws-shell__eyebrow {
  font-size: var(--font-size-caption);
  color: var(--color-green);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.04em;
}

.ws-shell__heading {
  margin-top: var(--space-1);
  font-size: clamp(1.4rem, 3vw, 1.85rem);
  color: var(--color-ink);
}

.ws-shell__content {
  min-height: 0;
}

.ws-shell__nav {
  position: fixed;
  left: 50%;
  bottom: var(--space-3);
  transform: translateX(-50%);
  width: min(calc(100% - 32px), 420px);
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: var(--space-1);
  padding: 8px;
  background: var(--color-paper-raised);
  border: var(--border-ink);
  border-radius: var(--radius-button);
  box-shadow: var(--shadow-soft);
}

.ws-shell__tab {
  border: 0;
  background: transparent;
  color: var(--color-ink-muted);
  border-radius: var(--radius-button);
  min-height: 44px;
  font-weight: var(--font-weight-medium);
}

.ws-shell__tab--active {
  background: var(--color-green);
  color: #f8f5ee;
}
```

- [ ] **Step 3: Restyle StartupPanel**

`StartupPanel.tsx`:

```tsx
import type { StartupViewState } from "../services/tauri/startup";
import "./StartupPanel.css";

type StartupPanelProps = {
  viewState: StartupViewState;
  message: string;
  workspacePath: string | null;
};

export function StartupPanel({
  viewState,
  message,
  workspacePath,
}: StartupPanelProps) {
  return (
    <main className="ws-startup">
      <section className="ws-startup__panel">
        <p className="ws-startup__eyebrow">Work Shackle</p>
        <h1>正在把桌子擦干净</h1>
        <p className={`ws-startup__status ws-startup__status--${viewState}`}>
          {message}
        </p>
        {workspacePath ? (
          <p className="ws-startup__path">{workspacePath}</p>
        ) : null}
      </section>
    </main>
  );
}
```

`StartupPanel.css`:

```css
.ws-startup {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: var(--space-4);
}

.ws-startup__panel {
  width: min(100%, 420px);
  text-align: center;
  background: var(--color-paper-raised);
  border: var(--border-ink);
  border-radius: var(--radius-panel);
  box-shadow: var(--shadow-soft);
  padding: var(--space-5) var(--space-4);
}

.ws-startup__eyebrow {
  color: var(--color-green);
  font-size: var(--font-size-caption);
  font-weight: var(--font-weight-medium);
  margin-bottom: var(--space-2);
}

.ws-startup__panel h1 {
  font-size: var(--font-size-title);
}

.ws-startup__status {
  margin-top: var(--space-3);
}

.ws-startup__status--preparing {
  color: var(--color-ink-muted);
}

.ws-startup__status--ready {
  color: var(--color-green);
}

.ws-startup__status--workspaceNotFound,
.ws-startup__status--workspaceNotWritable,
.ws-startup__status--databaseInitFailed,
.ws-startup__status--validationFailed {
  color: var(--color-danger);
}

.ws-startup__path {
  margin-top: var(--space-2);
  font-size: var(--font-size-caption);
  color: var(--color-ink-muted);
  word-break: break-all;
}
```

- [ ] **Step 4: Wire `App.tsx`**

Keep existing boot `useEffect`; render:

```tsx
import { useEffect, useState } from "react";
import {
  initializeApp,
  mapStartupError,
  type AppError,
  type StartupViewState,
} from "./services/tauri/startup";
import { AppShell } from "./shared/shell/AppShell";
import { StartupPanel } from "./pages/StartupPanel";

function App() {
  const [viewState, setViewState] = useState<StartupViewState>("preparing");
  const [message, setMessage] = useState("正在准备工作目录");
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setViewState("preparing");
      setMessage("正在准备工作目录");

      try {
        const ready = await initializeApp();
        if (cancelled) return;
        setWorkspacePath(ready.workspacePath);
        setViewState("ready");
        setMessage("工作目录已准备完成");
      } catch (error) {
        if (cancelled) return;
        const mapped = mapStartupError(error as AppError);
        setViewState(mapped.state);
        setMessage(mapped.message);
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, []);

  if (viewState === "ready") {
    return <AppShell />;
  }

  return (
    <StartupPanel
      viewState={viewState}
      message={message}
      workspacePath={workspacePath}
    />
  );
}

export default App;
```

- [ ] **Step 5: Build + run App**

1. Run: `npm run build` — Expected: PASS  
2. Run: `npm run tauri dev`（或项目惯用启动命令）— Expected: 启动成功后看到底部三 Tab；设置页可开 Modal/Drawer  
3. 若工具支持截图：截今日 / 任务 / 设置 / Modal / Drawer，做视觉自检（无科技蓝、圆润、纸感）

---

## Spec Coverage Checklist

| Spec 项 | Task |
|---|---|
| Design Tokens / 字体 / spacing / 圆角 / shadow | Task 1 |
| Card / Button | Task 2 |
| Modal / Drawer / Empty State / mascot | Task 3 |
| App Shell + 三空页 + Startup 换肤 | Task 4 |
| 不改 Rust / 无业务 / 无 Router|Tailwind | Global Constraints |
| `npm run build` + 实跑 + 截图自检 | Task 4 Step 5 |

## Self-Review Notes

- 无 TBD/TODO 占位。  
- 组件 props 名在后续任务一致。  
- Settings 页承担 Modal/Drawer 演示，避免污染今日/任务空态。  
- 提交策略遵循 Global Constraints：默认不 commit。  
