import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { STATUS_OPTIONS, createDefaultData } from "./domain/defaultData";
import type { Task, TaskInput, TaskStatus, WebData, WorkStatusType, WorkdayReminder } from "./domain/model";
import { autoStartTasks, changeTaskStatus, createTask, postponeTask, queryTodayTasks, setTaskPriority, updateTask } from "./domain/tasks";
import { activeOvertime, confirmNormalOff, countdown, currentStatus, dismissLunch, dueReminder, effectiveSchedule, endOvertime, localDate, lunchDue, markReminderFired, saveTodayEnd, startOvertime, switchStatus } from "./domain/workday";
import { loadDirectoryHandle, saveDirectoryHandle } from "./storage/directoryHandleStore";
import { ensurePermission, FileDataStore, StorageError } from "./storage/fileDataStore";
import { AppHeader } from "./ui/AppHeader";
import { StartupPanel } from "./ui/StartupPanel";
import { TodayCockpit } from "./features/today/TodayCockpit";
import { TodayTaskBoard } from "./features/today/TodayTaskBoard";
import { WorkdayTools, type SaveState } from "./features/today/WorkdayTools";
import { WebTaskDrawer } from "./features/tasks/WebTaskDrawer";
import { WebPostponeDialog } from "./features/tasks/WebPostponeDialog";

type Startup =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "needs-folder"; handle?: FileSystemDirectoryHandle }
  | { kind: "ready"; store: FileDataStore; data: WebData }
  | { kind: "recovery"; store: FileDataStore; error: string };

type DataWriter = Pick<FileDataStore, "save">;

export default function App() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "today") {
    const now = Date.now();
    const previewData = createTask(createDefaultData(now), { title: "准备需求评审材料", note: "把争议点和备选方案整理清楚", plannedAtMs: now - 45 * 60_000, deadlineAtMs: now + 3 * 60 * 60_000, priority: 3 }, now - 60 * 60_000);
    return <TodayApp initialData={previewData} store={{ save: async () => undefined }} />;
  }
  const [startup, setStartup] = useState<Startup>({ kind: "checking" });
  const openStore = useCallback(async (handle: FileSystemDirectoryHandle) => {
    const store = new FileDataStore(handle);
    try {
      const data = await store.initialize();
      await saveDirectoryHandle(handle);
      setStartup({ kind: "ready", store, data });
    } catch (error) {
      setStartup({ kind: "recovery", store, error: readableError(error) });
    }
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      if (!("showDirectoryPicker" in window)) {
        if (alive) setStartup({ kind: "unsupported" });
        return;
      }
      try {
        const handle = await loadDirectoryHandle();
        if (!alive) return;
        if (!handle) return setStartup({ kind: "needs-folder" });
        if (!await ensurePermission(handle)) return setStartup({ kind: "needs-folder", handle });
        await openStore(handle);
      } catch {
        if (alive) setStartup({ kind: "needs-folder" });
      }
    })();
    return () => { alive = false; };
  }, [openStore]);

  const chooseFolder = async () => {
    try {
      const handle = startup.kind === "needs-folder" && startup.handle ? startup.handle : await window.showDirectoryPicker({ id: "work-shackle-web-data", mode: "readwrite" });
      if (!await ensurePermission(handle, true)) return;
      await openStore(handle);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setStartup({ kind: "needs-folder" });
    }
  };

  if (startup.kind === "checking") return <StartupPanel title="正在读取工作档案" copy="稍等，先把今天的班味加载出来。" />;
  if (startup.kind === "unsupported") return <StartupPanel title="当前浏览器不支持本地文件夹" copy="请使用最新版 Chrome 或 Edge 打开此页面，历史数据才能安全保存在你选择的文件夹中。" />;
  if (startup.kind === "needs-folder") return <StartupPanel title={startup.handle ? "重新授权数据文件夹" : "先选择一个数据文件夹"} copy={startup.handle ? "浏览器需要你再次确认原文件夹，已有数据不会被重置。" : "任务和历史记录都会保存在这个文件夹里，不上传云端。"}><button className="button button--primary" onClick={() => void chooseFolder()}>{startup.handle ? "授权原文件夹" : "选择数据文件夹"}</button></StartupPanel>;
  if (startup.kind === "recovery") return <StartupPanel title="数据文件需要恢复" copy={startup.error} tone="danger"><button className="button button--primary" onClick={() => void startup.store.restorePrevious().then((data) => setStartup({ kind: "ready", store: startup.store, data })).catch((error) => setStartup({ kind: "recovery", store: startup.store, error: readableError(error) }))}>从上一版本恢复</button><button className="button button--ghost" onClick={() => setStartup({ kind: "needs-folder" })}>选择其他文件夹</button></StartupPanel>;
  return <TodayApp initialData={startup.data} store={startup.store} />;
}

function TodayApp({ initialData, store }: { initialData: WebData; store: DataWriter }) {
  const [data, setData] = useState(initialData);
  const dataRef = useRef(initialData);
  const writeChain = useRef(Promise.resolve());
  const revision = useRef(0);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState("");
  const [nowMs, setNowMs] = useState(Date.now());
  const [taskDialog, setTaskDialog] = useState<{ mode: "create" | "edit"; task?: Task } | null>(null);
  const [postponeTarget, setPostponeTarget] = useState<Task | null>(null);
  const [notice, setNotice] = useState<{ title: string; message: string } | null>(null);
  const [unavailablePage, setUnavailablePage] = useState<"任务" | "设置" | null>(null);

  const commit = useCallback((change: (current: WebData) => WebData) => {
    let next: WebData;
    try { next = change(dataRef.current); } catch (error) { setSaveError(readableError(error)); return; }
    dataRef.current = next;
    setData(next);
    setSaveError("");
    setSaveState("saving");
    const ownRevision = ++revision.current;
    writeChain.current = writeChain.current.then(() => store.save(next)).then(() => { if (revision.current === ownRevision) setSaveState("saved"); }).catch((error) => { setSaveState("unsaved"); setSaveError(readableError(error)); });
  }, [store]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const result = autoStartTasks(dataRef.current, nowMs);
    if (result.ids.length) {
      commit(() => result.data);
      setNotice({ title: "任务自动开始", message: `有 ${result.ids.length} 个计划任务已经开跑。` });
    }
    const workReminder = dueReminder(dataRef.current, nowMs);
    if (workReminder) {
      commit((current) => markReminderFired(switchStatus(current, workReminder.suggestedStatus, nowMs), workReminder, nowMs));
      fireNotification(workReminder.label, workReminder.message);
      setNotice({ title: workReminder.label, message: workReminder.message });
    }
    const taskReminder = dataRef.current.taskReminders.find((item) => item.enabled && nowMs >= item.remindAtMs && nowMs - item.remindAtMs <= 5 * 60_000 && !dataRef.current.reminderFires.some((fire) => fire.key === `task:${item.id}`));
    if (taskReminder) {
      const task = dataRef.current.tasks.find((item) => item.id === taskReminder.taskId);
      commit((current) => ({ ...current, reminderFires: [...current.reminderFires, { key: `task:${taskReminder.id}`, firedAtMs: nowMs }] }));
      fireNotification(task?.title ?? "任务提醒", taskReminder.message ?? "该看看这个任务了。");
      setNotice({ title: task?.title ?? "任务提醒", message: taskReminder.message ?? "该看看这个任务了。" });
    }
  }, [nowMs, commit]);

  const today = useMemo(() => queryTodayTasks(data, nowMs), [data, nowMs]);
  const schedule = effectiveSchedule(data, nowMs);
  const count = countdown(data, nowMs);
  const status = currentStatus(data);
  const statusOption = STATUS_OPTIONS.find((item) => item.id === status?.statusType);
  const overtime = activeOvertime(data);
  const decision = data.workEndDecisions.find((item) => item.workDate === schedule.workDate);

  const retrySave = () => {
    setSaveState("saving");
    void store.save(dataRef.current).then(() => { setSaveState("saved"); setSaveError(""); }).catch((error) => { setSaveState("unsaved"); setSaveError(readableError(error)); });
  };

  const downloadBackup = () => {
    const blob = new Blob([JSON.stringify(dataRef.current, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `work-shackle-web-backup-${localDate()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleStatus = (task: Task, nextStatus: TaskStatus) => {
    if (nextStatus === "cancelled" && !window.confirm("确定取消这个任务吗？取消后仍保留在历史记录中。")) return;
    commit((current) => changeTaskStatus(current, task.id, nextStatus, nowMs));
  };

  const saveTask = (input: TaskInput) => {
    if (!taskDialog) return;
    commit((current) => taskDialog.mode === "create" ? createTask(current, input, nowMs) : updateTask(current, taskDialog.task!.id, input, nowMs));
    setTaskDialog(null);
  };

  const saveReminders = (reminders: WorkdayReminder[]) => commit((current) => ({ ...current, updatedAtMs: Date.now(), workdayReminders: reminders }));

  return (
    <div className="ws-shell">
      <AppHeader statusName={statusOption?.name ?? "还未选择状态"} statusEmoji={statusOption?.emoji ?? "·"} onUnavailable={setUnavailablePage} />
      <main className="ws-content">
        {window.innerWidth < 1024 ? <div className="width-warning">建议把浏览器窗口放大到 1024px 以上，工位会更舒展。</div> : null}
        {unavailablePage ? <div className="ws-notice" role="status"><strong>{unavailablePage}页面</strong><span>Web 端暂未开放，当前仍停留在今日页面。</span><button onClick={() => setUnavailablePage(null)}>知道了</button></div> : null}
        {notice ? <div className="ws-notice ws-notice--blue" role="status"><strong>{notice.title}</strong><span>{notice.message}</span><button onClick={() => setNotice(null)}>知道了</button></div> : null}
        {lunchDue(data, nowMs) ? <div className="ws-notice ws-notice--lunch"><strong>到饭点了</strong><span>先把人类基础需求处理一下。</span><button onClick={() => commit((current) => dismissLunch(switchStatus(current, "lunch", nowMs), nowMs))}>切到午餐中</button><button onClick={() => commit((current) => dismissLunch(current, nowMs))}>稍后再说</button></div> : null}
        <TodayCockpit schedule={schedule} count={count} nowMs={nowMs} status={status} overtime={overtime} decision={decision} onStatus={(next) => commit((current) => switchStatus(current, next as WorkStatusType, nowMs))} onNormalOff={() => commit((current) => confirmNormalOff(current, nowMs))} onStartOvertime={() => commit((current) => startOvertime(current, nowMs))} onEndOvertime={() => commit((current) => endOvertime(current, nowMs))} />
        <section className="today-grid">
          <TodayTaskBoard today={today} nowMs={nowMs} onCreate={() => setTaskDialog({ mode: "create" })} onEdit={(task) => setTaskDialog({ mode: "edit", task })} onPostpone={setPostponeTarget} onStatus={handleStatus} onPriority={(task, priority) => commit((current) => setTaskPriority(current, task.id, priority, nowMs))} />
          <WorkdayTools data={data} endTime={schedule.end} saveState={saveState} saveError={saveError} onChangeEnd={(end) => commit((current) => saveTodayEnd(current, end, nowMs))} onRemindersChange={saveReminders} onBackup={downloadBackup} onRetrySave={retrySave} onRequestNotifications={typeof Notification !== "undefined" && Notification.permission !== "granted" ? () => void Notification.requestPermission() : undefined} />
        </section>
      </main>
      {taskDialog ? <WebTaskDrawer mode={taskDialog.mode} task={taskDialog.task} data={data} onClose={() => setTaskDialog(null)} onSave={saveTask} /> : null}
      {postponeTarget ? <WebPostponeDialog task={postponeTarget} onClose={() => setPostponeTarget(null)} onSave={(deadline, reason) => { commit((current) => postponeTask(current, postponeTarget.id, deadline, reason, nowMs)); setPostponeTarget(null); }} /> : null}
    </div>
  );
}

function fireNotification(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body });
}

function readableError(error: unknown) {
  return error instanceof StorageError || error instanceof Error ? error.message : "操作失败，请重试";
}
