import "./AppHeader.css";

const tabs = [
  { label: "今日状态", short: "今日", icon: "⌁", page: "today" as const },
  { label: "任务现场", short: "任务", icon: "✓", page: "任务" as const },
  { label: "生存设置", short: "设置", icon: "≡", page: "设置" as const },
];

export function AppHeader({ statusName, statusEmoji, onUnavailable }: { statusName: string; statusEmoji: string; onUnavailable: (page: "任务" | "设置") => void }) {
  return (
    <header className="ws-header">
      <div className="ws-header__brand-lockup">
        <span className="ws-header__logo" aria-hidden="true">WS</span>
        <div><h1>精神状态事务所</h1><p>OFFICE SURVIVAL SYSTEM</p></div>
      </div>
      <div className="ws-header__actions">
        <p className="ws-header__live" aria-label={`当前工作状态：${statusName}`}><span aria-hidden="true">{statusEmoji}</span><b>{statusName}</b></p>
        <nav className="ws-nav" aria-label="主导航">
          <span className="ws-nav__indicator" aria-hidden="true" />
          {tabs.map((tab) => (
            <button
              key={tab.page}
              type="button"
              aria-label={tab.label}
              aria-current={tab.page === "today" ? "page" : undefined}
              className={`ws-nav__tab${tab.page === "today" ? " ws-nav__tab--active" : ""}`}
              onClick={() => tab.page !== "today" && onUnavailable(tab.page)}
            >
              <span aria-hidden="true">{tab.icon}</span><b>{tab.short}</b><i aria-hidden="true" />
            </button>
          ))}
        </nav>
      </div>
    </header>
  );
}
