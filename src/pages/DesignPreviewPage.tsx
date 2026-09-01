import { useMemo, useState } from "react";

import { CreateTaskDrawer } from "../features/tasks/CreateTaskDrawer";
import { TodayTaskBoard } from "../features/today/TodayTaskBoard";
import { WorkCountdownBanner } from "../features/today/WorkCountdownBanner";
import { WorkScheduleEditor } from "../features/today/WorkScheduleEditor";
import type { WorkSchedule } from "../services/tauri/settings";
import type { Task, TodayTasks } from "../services/tauri/tasks";
import { AppNavigation } from "../shared/shell/AppNavigation";
import { AppUpdateAvatar } from "../shared/shell/AppUpdateAvatar";
import type { AppUpdateState } from "../shared/shell/useAppUpdate";
import { Button, Card, Mascot } from "../shared/ui";
import "../shared/shell/AppShell.css";
import "../features/today/StatusCockpit.css";
import "./TodayPage.css";

export function DesignPreviewPage() {
  const schedule = useMemo(buildPreviewSchedule, []);
  const tasks = useMemo(buildPreviewTasks, []);
  const updateState = useMemo(buildPreviewUpdateState, []);
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="ws-shell">
      <header className="ws-shell__brand">
        <div className="ws-shell__brand-lockup">
          <AppUpdateAvatar state={updateState} onActivate={() => undefined} />
          <div className="ws-shell__brand-copy">
            <h1 className="ws-shell__heading">精神状态事务所</h1>
            <p className="ws-shell__eyebrow">Office survival system</p>
          </div>
        </div>
        <div className="ws-shell__header-actions">
          <p className="ws-shell__live" aria-label="当前状态：人还在线">
            <span className="ws-shell__live-label">人还在线</span>
          </p>
          <AppNavigation currentTab="today" onChange={() => undefined} />
        </div>
      </header>

      <main className="ws-shell__content">
        <div className="today-page__dashboard">
          <section className="today-page__stage" aria-label="今日下班进度">
            <div className="status-cockpit">
              <div className="status-cockpit__work">
                <WorkCountdownBanner
                  display={{
                    phase: "working",
                    primaryText: "离下班越近，灵魂越完整",
                    countdownText: "02:47:19",
                  }}
                  schedule={schedule}
                />
              </div>
              <aside className="status-cockpit__reaction" aria-label="当前工作状态">
                <div className="status-cockpit__status-row">
                  <span>当前精神档位</span>
                  <span>🏃 被需求追杀</span>
                </div>
                <div className="status-cockpit__meme">
                  <span className="status-cockpit__meme-mark" aria-hidden="true">跑</span>
                  <Mascot state="offwork-run" animation="run" size="lg" className="status-cockpit__mascot" />
                  <div className="status-cockpit__speech">
                    <strong>🏃 被需求追杀</strong>
                    <p>需求说不急，只是希望你十分钟前交。</p>
                  </div>
                </div>
              </aside>
            </div>
          </section>

          <Card
            title="今天这些破事"
            headerAccent
            className="today-page__tasks-card"
          >
            <div className="today-page__toolbar">
              <p>⚠ 别让 DDL 先动手</p>
              <Button onClick={() => setCreateOpen(true)}>＋ 再塞一件</Button>
            </div>
            <TodayTaskBoard
              tasks={tasks}
              announcedTaskIds={tasks.autoStartedTaskIds}
              onPriorityChange={() => undefined}
            />
          </Card>

          <WorkScheduleEditor schedule={schedule} onSaved={() => undefined} />
        </div>
      </main>
      <CreateTaskDrawer open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}

function buildPreviewUpdateState(): AppUpdateState {
  const state = new URLSearchParams(window.location.search).get("update");
  if (state === "available") {
    return { status: "available", version: "0.1.2", body: "修复窗口边缘" };
  }
  if (state === "downloading") {
    return { status: "downloading", version: "0.1.2", progress: 68 };
  }
  if (state === "installing") {
    return { status: "installing", version: "0.1.2" };
  }
  if (state === "failed") {
    return {
      status: "failed",
      message: "更新安装失败，点击重试",
      retry: "install",
    };
  }
  return { status: "current" };
}

function buildPreviewSchedule(): WorkSchedule {
  const now = new Date();
  const start = new Date(now.getTime() - 5.5 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);
  return {
    workDate: formatDate(now),
    defaultStart: formatTime(start),
    defaultEnd: formatTime(end),
    effectiveStart: formatTime(start),
    effectiveEnd: formatTime(end),
    hasTodayOverride: false,
  };
}

function buildPreviewTasks(): TodayTasks {
  const now = Date.now();
  const hour = 60 * 60 * 1000;
  return {
    upcomingDeadlineTasks: [
      task("ddl", "把“马上上线”拆成可执行计划", now - 2 * hour, now + 1.3 * hour, 3, "in_progress"),
    ],
    formalTasks: [
      task("meeting", "参加需求反复横跳研讨会", now - hour, now + 3 * hour, 2, "waiting"),
      task("reply", "假装没看到群里的 @所有人", now, now + 5 * hour, 1, "in_progress"),
    ],
    overdueTasks: [
      task("debt-light", "客户说再润色一下", now - 24 * hour, now - 12 * hour, 1, "paused"),
      task("debt-serious", "需求已经改到第八版", now - 60 * hour, now - 36 * hour, 2, "waiting"),
      task("debt-gave-up", "上周五说马上要的活", now - 120 * hour, now - 96 * hour, 3, "paused"),
    ],
    completedTodayTasks: [],
    autoStartedTaskIds: ["reply"],
  };
}

function task(
  id: string,
  title: string,
  plannedAtMs: number,
  deadlineAtMs: number,
  priority: number,
  status: Task["status"],
): Task {
  return {
    id,
    title,
    plannedAtMs,
    deadlineAtMs,
    priority,
    status,
    note:
      id === "meeting"
        ? "备注：带上第七版需求稿，先确认哪些内容没有再次变化"
        : id === "reply"
          ? "备注：先处理真正影响上线的问题"
          : undefined,
    createdAtMs: plannedAtMs - 2 * 60 * 60 * 1000,
    updatedAtMs: Date.now(),
    contactSnapshot: id === "meeting" ? "产品经理" : undefined,
  };
}

function formatDate(value: Date) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(value: Date) {
  return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
}
