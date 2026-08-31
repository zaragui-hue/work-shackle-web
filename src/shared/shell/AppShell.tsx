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
import { useWindowFullscreen } from "./useWindowFullscreen";
import "./AppShell.css";
import "./AppShellFullscreen.css";

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
  const { isFullscreen, exiting, exitFullscreen } = useWindowFullscreen();

  useReminderOpenTaskBridge(
    useCallback((taskId: string) => {
      setTab("tasks");
      setOpenTaskRequest(taskId);
    }, []),
  );

  return (
    <div className={`ws-shell${isFullscreen ? " ws-shell--fullscreen" : ""}`}>
      <header className="ws-shell__brand">
        <div className="ws-shell__brand-lockup">
          <span className="ws-shell__logo" aria-hidden="true">WS</span>
          <div className="ws-shell__brand-copy">
            <h1 className="ws-shell__heading">精神状态事务所</h1>
            <p className="ws-shell__eyebrow">Office survival system</p>
          </div>
        </div>
        <div className="ws-shell__header-actions">
          {isFullscreen ? (
            <button
              type="button"
              className="ws-shell__fullscreen-exit"
              aria-label="退出全屏"
              disabled={exiting}
              onClick={() => void exitFullscreen()}
            >
              <FullscreenExitIcon />
              <span>{exiting ? "正在退出" : "退出全屏"}</span>
            </button>
          ) : null}
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

function FullscreenExitIcon() {
  return (
    <svg
      className="ws-shell__fullscreen-exit-icon"
      viewBox="0 0 20 20"
      aria-hidden="true"
    >
      <path d="M8 3v5H3M12 3v5h5M8 17v-5H3M12 17v-5h5" />
    </svg>
  );
}
