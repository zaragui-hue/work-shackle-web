export type AppTabId = "today" | "tasks" | "settings";

type AppNavigationProps = {
  currentTab: AppTabId;
  onChange: (tab: AppTabId) => void;
};

const NAV_ITEMS: {
  id: AppTabId;
  label: string;
  shortLabel: string;
  icon: "pulse" | "tasks" | "settings";
}[] = [
  { id: "today", label: "今日状态", shortLabel: "今日", icon: "pulse" },
  { id: "tasks", label: "任务现场", shortLabel: "任务", icon: "tasks" },
  { id: "settings", label: "生存设置", shortLabel: "设置", icon: "settings" },
];

export function AppNavigation({ currentTab, onChange }: AppNavigationProps) {
  return (
    <nav
      className={`ws-shell__nav ws-shell__nav--${currentTab}`}
      aria-label="主导航"
    >
      <span className="ws-shell__nav-indicator" aria-hidden="true" />
      {NAV_ITEMS.map((item) => (
        <button
          key={item.id}
          type="button"
          className={`ws-shell__tab${
            currentTab === item.id ? " ws-shell__tab--active" : ""
          }`}
          aria-label={item.label}
          aria-current={currentTab === item.id ? "page" : undefined}
          onClick={() => onChange(item.id)}
        >
          <NavigationIcon name={item.icon} />
          <span className="ws-shell__tab-label">{item.shortLabel}</span>
          <span className="ws-shell__tab-signal" aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
}

function NavigationIcon({
  name,
}: {
  name: (typeof NAV_ITEMS)[number]["icon"];
}) {
  if (name === "pulse") {
    return (
      <svg className="ws-shell__tab-icon" viewBox="0 0 20 20" aria-hidden="true">
        <path d="M2.5 10h3l1.7-4.1 3.2 8.2 2.2-5.2 1.3 2.1h3.6" />
      </svg>
    );
  }

  if (name === "tasks") {
    return (
      <svg className="ws-shell__tab-icon" viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="3" width="14" height="14" rx="3" />
        <path d="m6.5 10 2.1 2.1 4.8-5" />
      </svg>
    );
  }

  return (
    <svg className="ws-shell__tab-icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 5h12M4 10h12M4 15h12" />
      <circle cx="7" cy="5" r="1.5" />
      <circle cx="13" cy="10" r="1.5" />
      <circle cx="8" cy="15" r="1.5" />
    </svg>
  );
}
