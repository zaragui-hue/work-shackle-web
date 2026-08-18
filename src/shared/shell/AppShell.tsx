import { useCallback, useState } from "react";
import { TodayPage } from "../../pages/TodayPage";
import { TasksPage } from "../../pages/TasksPage";
import { SettingsPage } from "../../pages/SettingsPage";
import { useReminderOpenTaskBridge } from "../../features/reminder/reminderWindowActions";
import "./AppShell.css";

type TabId = "today" | "tasks" | "settings";

const TABS: { id: TabId; label: string }[] = [
  { id: "today", label: "今日" },
  { id: "tasks", label: "任务" },
  { id: "settings", label: "设置" },
];

export function AppShell() {
  const [tab, setTab] = useState<TabId>("today");
  const [openTaskRequest, setOpenTaskRequest] = useState<string | null>(null);

  useReminderOpenTaskBridge(
    useCallback((taskId: string) => {
      setTab("tasks");
      setOpenTaskRequest(taskId);
    }, []),
  );

  return (
    <div className="ws-shell">
      <header className="ws-shell__brand">
        <div className="ws-shell__brand-copy">
          <p className="ws-shell__eyebrow">Work Shackle</p>
          <h1 className="ws-shell__heading">慢慢搬砖，也要好好喘气</h1>
        </div>
        <span className="ws-shell__chip" aria-hidden="true">
          班味加载中…
        </span>
      </header>

      <main className="ws-shell__content" aria-live="polite">
        {tab === "today" ? <TodayPage /> : null}
        {tab === "tasks" ? (
          <TasksPage
            openTaskRequest={openTaskRequest}
            onOpenTaskHandled={() => setOpenTaskRequest(null)}
          />
        ) : null}
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
