import { useCallback, useState } from "react";
import { TodayPage } from "../../pages/TodayPage";
import { TasksPage } from "../../pages/TasksPage";
import { SettingsPage } from "../../pages/SettingsPage";
import { useReminderOpenTaskBridge } from "../../features/reminder/reminderWindowActions";
import {
  WorkStatusProvider,
  useWorkStatus,
} from "../../features/today/WorkStatusContext";
import { AppNavigation, type AppTabId } from "./AppNavigation";
import "./AppShell.css";

export function AppShell() {
  return (
    <WorkStatusProvider>
      <AppShellContent />
    </WorkStatusProvider>
  );
}

function AppShellContent() {
  const [tab, setTab] = useState<AppTabId>("today");
  const [openTaskRequest, setOpenTaskRequest] = useState<string | null>(null);
  const { current, loading } = useWorkStatus();

  useReminderOpenTaskBridge(
    useCallback((taskId: string) => {
      setTab("tasks");
      setOpenTaskRequest(taskId);
    }, []),
  );

  return (
    <div className="ws-shell">
      <header className="ws-shell__brand">
        <div className="ws-shell__brand-lockup">
          <span className="ws-shell__logo" aria-hidden="true">WS</span>
          <div className="ws-shell__brand-copy">
            <h1 className="ws-shell__heading">精神状态事务所</h1>
            <p className="ws-shell__eyebrow">Office survival system</p>
          </div>
        </div>
        <div className="ws-shell__header-actions">
          <p
            className={`ws-shell__live${loading ? " ws-shell__live--loading" : ""}`}
            aria-label={`当前工作状态：${current?.name ?? "正在读取"}`}
          >
            <span className="ws-shell__live-emoji" aria-hidden="true">
              {current?.emoji ?? "·"}
            </span>
            <span className="ws-shell__live-label">{current?.name ?? "读取状态"}</span>
          </p>
          <AppNavigation currentTab={tab} onChange={setTab} />
        </div>
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

    </div>
  );
}
