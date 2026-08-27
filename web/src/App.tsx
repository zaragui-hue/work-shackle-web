import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { STATUS_OPTIONS } from "./domain/defaultData";
import { createDefaultData } from "./domain/defaultData";
import type { Task, TaskInput, TaskStatus, WebData, WorkStatusType, WorkdayReminder } from "./domain/model";
import { autoStartTasks, changeTaskStatus, createTask, postponeTask, queryTodayTasks, setTaskPriority, updateTask } from "./domain/tasks";
import { activeOvertime, confirmNormalOff, countdown, currentStatus, dismissLunch, dueReminder, effectiveSchedule, endOvertime, localDate, lunchDue, markReminderFired, saveTodayEnd, startOvertime, switchStatus } from "./domain/workday";
import { loadDirectoryHandle, saveDirectoryHandle } from "./storage/directoryHandleStore";
import { ensurePermission, FileDataStore, StorageError } from "./storage/fileDataStore";

type Startup =
  | { kind: "checking" }
  | { kind: "unsupported" }
  | { kind: "needs-folder"; handle?: FileSystemDirectoryHandle }
  | { kind: "ready"; store: FileDataStore; data: WebData }
  | { kind: "recovery"; store: FileDataStore; error: string };

type SaveState = "saved" | "saving" | "unsaved";
type DataWriter = Pick<FileDataStore, "save">;

export default function App() {
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "today") {
    const now = Date.now();
    const previewData = createTask(createDefaultData(now), {
      title: "准备需求评审材料",
      note: "把争议点和备选方案整理清楚",
      plannedAtMs: now - 45 * 60_000,
      deadlineAtMs: now + 3 * 60 * 60_000,
      priority: 3,
    }, now - 60 * 60_000);
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
      const handle = startup.kind === "needs-folder" && startup.handle
        ? startup.handle
        : await window.showDirectoryPicker({ id: "work-shackle-web-data", mode: "readwrite" });
      if (!await ensurePermission(handle, true)) return;
      await openStore(handle);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) setStartup({ kind: "needs-folder" });
    }
  };

  if (startup.kind === "checking") return <CenteredPanel title="正在读取工作档案" copy="稍等，先把今天的班味加载出来。" />;
  if (startup.kind === "unsupported") return <CenteredPanel title="当前浏览器不支持本地文件夹" copy="请使用最新版 Chrome 或 Edge 打开此页面，历史数据才能安全保存在你选择的文件夹中。" />;
  if (startup.kind === "needs-folder") return (
    <CenteredPanel title={startup.handle ? "重新授权数据文件夹" : "先选择一个数据文件夹"} copy={startup.handle ? "浏览器需要你再次确认原文件夹，已有数据不会被重置。" : "任务和历史记录都会保存在这个文件夹里，不上传云端。"}>
      <button className="button button--primary" onClick={() => void chooseFolder()}>{startup.handle ? "授权原文件夹" : "选择数据文件夹"}</button>
    </CenteredPanel>
  );
  if (startup.kind === "recovery") return (
    <CenteredPanel title="数据文件需要恢复" copy={startup.error} tone="danger">
      <button className="button button--primary" onClick={() => void startup.store.restorePrevious().then((data) => setStartup({ kind: "ready", store: startup.store, data })).catch((error) => setStartup({ kind: "recovery", store: startup.store, error: readableError(error) }))}>从上一版本恢复</button>
      <button className="button button--ghost" onClick={() => setStartup({ kind: "needs-folder" })}>选择其他文件夹</button>
    </CenteredPanel>
  );
  return <TodayApp initialData={startup.data} store={startup.store} />;
}

function CenteredPanel({ title, copy, children, tone }: { title: string; copy: string; children?: React.ReactNode; tone?: "danger" }) {
  return <main className="startup"><section className={`startup__card${tone ? ` startup__card--${tone}` : ""}`}><span className="startup__stamp">WS / LOCAL WEB</span><div className="startup__horse" aria-hidden="true">🐎</div><h1>{title}</h1><p>{copy}</p>{children ? <div className="startup__actions">{children}</div> : null}</section></main>;
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

  const commit = useCallback((change: (current: WebData) => WebData) => {
    let next: WebData;
    try { next = change(dataRef.current); } catch (error) { setSaveError(readableError(error)); return; }
    dataRef.current = next;
    setData(next);
    setSaveError("");
    setSaveState("saving");
    const ownRevision = ++revision.current;
    writeChain.current = writeChain.current.then(() => store.save(next)).then(() => {
      if (revision.current === ownRevision) setSaveState("saved");
    }).catch((error) => {
      setSaveState("unsaved");
      setSaveError(readableError(error));
    });
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand__logo">WS</span><div><h1>精神状态事务所</h1><p>OFFICE SURVIVAL SYSTEM · WEB</p></div></div>
        <div className="topbar__actions">
          <span className={`save-pill save-pill--${saveState}`}>{saveState === "saved" ? "● 已保存" : saveState === "saving" ? "◌ 保存中" : "! 尚未保存"}</span>
          {typeof Notification !== "undefined" && Notification.permission !== "granted" ? <button className="button button--ghost" onClick={() => void Notification.requestPermission()}>开启浏览器通知</button> : null}
          <button className="button button--ghost" onClick={downloadBackup}>立即备份</button>
          <span className="status-chip">{statusOption?.emoji ?? "·"} {statusOption?.name ?? "还未选择状态"}</span>
          <button className="today-tab" aria-current="page">⌁ 今日</button>
        </div>
      </header>

      <main className="page">
        {window.innerWidth < 1024 ? <div className="width-warning">建议把浏览器窗口放大到 1024px 以上，工位会更舒展。</div> : null}
        {saveError ? <div className="alert alert--danger"><span>{saveError}</span>{saveState === "unsaved" ? <button onClick={retrySave}>重试保存</button> : null}</div> : null}
        {notice ? <div className="alert alert--notice"><strong>{notice.title}</strong><span>{notice.message}</span><button onClick={() => setNotice(null)}>知道了</button></div> : null}
        {lunchDue(data, nowMs) ? <div className="alert alert--lunch"><strong>🍚 到饭点了</strong><span>先把人类基础需求处理一下。</span><button onClick={() => commit((current) => dismissLunch(switchStatus(current, "lunch", nowMs), nowMs))}>切到午餐中</button><button onClick={() => commit((current) => dismissLunch(current, nowMs))}>稍后再说</button></div> : null}

        <section className="cockpit">
          <div className="cockpit__copy">
            <span className="kicker">TODAY / {schedule.workDate}</span>
            <h2>{count.phase === "before_start" ? "离开工还有" : count.phase === "working" ? "离下班还有" : overtime ? "正在加班" : decision?.kind === "normal" ? "今天已经下班" : "到点了，走还是卷？"}</h2>
            <div className="countdown">{count.phase === "after_end" ? overtime ? formatDuration(nowMs - overtime.startAtMs) : "00:00:00" : formatDuration(count.remainingMs)}</div>
            <p>{status?.displayCopy ?? "选个状态，今天的工位广播就开张。"}</p>
            <label className="field field--inline"><span>当前状态</span><select value={status?.statusType ?? ""} onChange={(event) => commit((current) => switchStatus(current, event.target.value as WorkStatusType, nowMs))}><option value="" disabled>选择状态</option>{STATUS_OPTIONS.filter((item) => item.selectable).map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></label>
          </div>
          <div className="mascot-stage"><div className="sun" /><div className="horse" aria-label="正在工位奔跑的马">🐎</div><div className="track"><span /></div><small>{schedule.start} 上班 · {schedule.end} 下班</small></div>
        </section>

        {count.phase === "after_end" && !overtime && !decision ? <section className="decision-card"><div><span className="kicker">WORKDAY DECISION</span><h3>今天准备怎么收场？</h3><p>正常下班会结束当前状态；加班则继续计算工位时长。</p></div><div><button className="button button--primary" onClick={() => commit((current) => confirmNormalOff(current, nowMs))}>正常下班</button><button className="button button--dark" onClick={() => commit((current) => startOvertime(current, nowMs))}>开始加班</button></div></section> : null}
        {overtime ? <section className="decision-card decision-card--night"><div><span className="kicker">OVERTIME ACTIVE</span><h3>月亮值班，你也值班</h3><p>已加班 {formatDuration(nowMs - overtime.startAtMs)}，别忘了给今天画句号。</p></div><button className="button button--light" onClick={() => commit((current) => endOvertime(current, nowMs))}>结束加班</button></section> : null}

        <section className="workspace-grid">
          <div className="task-column">
            <div className="section-head"><div><span className="kicker">TODAY TASKS</span><h2>今日作战台</h2></div><button className="button button--primary" onClick={() => setTaskDialog({ mode: "create" })}>＋ 新建任务</button></div>
            <TaskSection title="正在发生" empty="今天还没有正式任务。" tasks={today.formalTasks} onEdit={(task) => setTaskDialog({ mode: "edit", task })} onPostpone={setPostponeTarget} commit={commit} nowMs={nowMs} />
            {today.overdueTasks.length ? <TaskSection title="昨日烂尾现场" tone="danger" tasks={today.overdueTasks} onEdit={(task) => setTaskDialog({ mode: "edit", task })} onPostpone={setPostponeTarget} commit={commit} nowMs={nowMs} /> : null}
            {today.completedTodayTasks.length ? <details className="completed"><summary>✓ 今天已经搞定 {today.completedTodayTasks.length} 件事</summary><TaskSection title="" tasks={today.completedTodayTasks} onEdit={(task) => setTaskDialog({ mode: "edit", task })} onPostpone={setPostponeTarget} commit={commit} nowMs={nowMs} /></details> : null}
          </div>
          <aside className="tools-column">
            <section className="tool-card"><span className="kicker">WORKDAY TOOLS</span><h2>工位控制台</h2><label className="field"><span>今日下班时间</span><input type="time" value={schedule.end} onChange={(event) => commit((current) => saveTodayEnd(current, event.target.value, nowMs))} /></label><p className="tool-note">默认 {data.schedule.defaultStart} — {data.schedule.defaultEnd}，这里只调整今天。</p></section>
            <ReminderEditor reminders={data.workdayReminders} commit={commit} />
          </aside>
        </section>
      </main>

      {taskDialog ? <TaskDialog mode={taskDialog.mode} task={taskDialog.task} data={data} onClose={() => setTaskDialog(null)} onSave={(input) => { commit((current) => taskDialog.mode === "create" ? createTask(current, input, nowMs) : updateTask(current, taskDialog.task!.id, input, nowMs)); setTaskDialog(null); }} /> : null}
      {postponeTarget ? <PostponeDialog task={postponeTarget} onClose={() => setPostponeTarget(null)} onSave={(deadline, reason) => { commit((current) => postponeTask(current, postponeTarget.id, deadline, reason, nowMs)); setPostponeTarget(null); }} /> : null}
    </div>
  );
}

function TaskSection({ title, empty, tone, tasks, onEdit, onPostpone, commit, nowMs }: { title: string; empty?: string; tone?: "danger"; tasks: Task[]; onEdit: (task: Task) => void; onPostpone: (task: Task) => void; commit: (change: (data: WebData) => WebData) => void; nowMs: number }) {
  return <section className={`task-section${tone ? ` task-section--${tone}` : ""}`}>{title ? <div className="task-section__title"><h3>{title}</h3><span>{tasks.length}</span></div> : null}{tasks.length === 0 ? <div className="empty-state"><span>✓</span><p>{empty}</p></div> : <div className="task-list">{tasks.map((task) => <TaskCard key={task.id} task={task} nowMs={nowMs} onEdit={() => onEdit(task)} onPostpone={() => onPostpone(task)} onStatus={(status) => commit((data) => changeTaskStatus(data, task.id, status, nowMs))} onPriority={(priority) => commit((data) => setTaskPriority(data, task.id, priority, nowMs))} />)}</div>}</section>;
}

function TaskCard({ task, nowMs, onEdit, onPostpone, onStatus, onPriority }: { task: Task; nowMs: number; onEdit: () => void; onPostpone: () => void; onStatus: (status: TaskStatus) => void; onPriority: (priority: number) => void }) {
  const progress = task.deadlineAtMs ? Math.max(0, Math.min(100, ((nowMs - task.plannedAtMs) / (task.deadlineAtMs - task.plannedAtMs)) * 100)) : 0;
  return <article className={`task-card task-card--p${task.priority}`}><button className="task-card__main" onClick={onEdit}><div className="task-card__time">{formatClock(task.plannedAtMs)}<small>{task.deadlineAtMs ? `DDL ${formatClock(task.deadlineAtMs)}` : "无 DDL"}</small></div><div className="task-card__body"><h4>{task.title}</h4>{task.note ? <p>{task.note}</p> : null}{task.deadlineAtMs ? <div className="progress"><span style={{ width: `${progress}%` }} /></div> : null}</div></button><div className="task-card__actions"><label><span className="sr-only">优先级</span><select aria-label={`${task.title}优先级`} value={task.priority} onChange={(event) => onPriority(Number(event.target.value))}><option value={3}>P3 紧急</option><option value={2}>P2 重要</option><option value={1}>P1 普通</option></select></label>{task.status !== "completed" ? <button onClick={() => onStatus("completed")}>完成</button> : null}{task.deadlineAtMs && task.status !== "completed" ? <button onClick={onPostpone}>延期</button> : null}{!(["completed", "cancelled"] as TaskStatus[]).includes(task.status) ? <button onClick={() => { if (window.confirm("确定取消这个任务吗？取消后仍保留在历史记录中。")) onStatus("cancelled"); }}>取消</button> : null}</div></article>;
}

function TaskDialog({ mode, task, data, onClose, onSave }: { mode: "create" | "edit"; task?: Task; data: WebData; onClose: () => void; onSave: (input: TaskInput) => void }) {
  const existingReminders = task ? data.taskReminders.filter((item) => item.taskId === task.id) : [];
  const [title, setTitle] = useState(task?.title ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [planned, setPlanned] = useState(toLocalInput(task?.plannedAtMs ?? Date.now()));
  const [deadline, setDeadline] = useState(task?.deadlineAtMs ? toLocalInput(task.deadlineAtMs) : "");
  const [priority, setPriority] = useState(task?.priority ?? 1);
  const [reminders, setReminders] = useState(existingReminders.map((item) => ({ remindAt: toLocalInput(item.remindAtMs), message: item.message ?? "" })));
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => { event.preventDefault(); try { const input: TaskInput = { title, note, plannedAtMs: new Date(planned).getTime(), deadlineAtMs: deadline ? new Date(deadline).getTime() : undefined, priority, reminders: reminders.map((item) => ({ remindAtMs: new Date(item.remindAt).getTime(), message: item.message })) }; if (!title.trim()) throw new Error("任务标题不能为空"); if (input.deadlineAtMs !== undefined && input.deadlineAtMs < input.plannedAtMs) throw new Error("DDL 不能早于计划时间"); onSave(input); } catch (caught) { setError(readableError(caught)); } };
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="task-dialog-title"><button className="modal__close" aria-label="关闭" onClick={onClose}>×</button><span className="kicker">TASK FILE</span><h2 id="task-dialog-title">{mode === "create" ? "新建任务" : "编辑任务"}</h2><form onSubmit={submit}><label className="field"><span>任务标题</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} /></label><label className="field"><span>备注</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="form-grid"><label className="field"><span>计划时间</span><input type="datetime-local" value={planned} onChange={(event) => setPlanned(event.target.value)} /></label><label className="field"><span>DDL</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div><label className="field"><span>优先级</span><select value={priority} onChange={(event) => setPriority(Number(event.target.value))}><option value={1}>P1 普通</option><option value={2}>P2 重要</option><option value={3}>P3 紧急</option></select></label><div className="reminder-form"><div className="reminder-form__head"><strong>任务提醒</strong>{reminders.length < 3 ? <button type="button" onClick={() => setReminders((items) => [...items, { remindAt: planned, message: "" }])}>＋ 加提醒</button> : null}</div>{reminders.map((item, index) => <div className="reminder-form__row" key={index}><input aria-label={`提醒时间 ${index + 1}`} type="datetime-local" value={item.remindAt} onChange={(event) => setReminders((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, remindAt: event.target.value } : value))} /><input aria-label={`提醒文案 ${index + 1}`} placeholder="提醒文案" value={item.message} onChange={(event) => setReminders((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, message: event.target.value } : value))} /><button type="button" onClick={() => setReminders((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</div>{error ? <p className="form-error">{error}</p> : null}<div className="modal__actions"><button type="button" className="button button--ghost" onClick={onClose}>取消</button><button className="button button--primary" type="submit">保存任务</button></div></form></section></div>;
}

function PostponeDialog({ task, onClose, onSave }: { task: Task; onClose: () => void; onSave: (deadline: number, reason: string) => void }) {
  const [deadline, setDeadline] = useState(toLocalInput((task.deadlineAtMs ?? Date.now()) + 24 * 60 * 60 * 1000));
  const [reason, setReason] = useState("");
  return <div className="modal-backdrop"><section className="modal modal--small" role="dialog" aria-modal="true"><button className="modal__close" aria-label="关闭" onClick={onClose}>×</button><span className="kicker">DDL CONTROL</span><h2>延期：{task.title}</h2><label className="field"><span>新 DDL</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><label className="field"><span>延期原因</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="modal__actions"><button className="button button--ghost" onClick={onClose}>取消</button><button className="button button--primary" onClick={() => onSave(new Date(deadline).getTime(), reason)}>确认延期</button></div></section></div>;
}

function ReminderEditor({ reminders, commit }: { reminders: WorkdayReminder[]; commit: (change: (data: WebData) => WebData) => void }) {
  const mutate = (next: WorkdayReminder[]) => commit((data) => ({ ...data, updatedAtMs: Date.now(), workdayReminders: next }));
  const update = (id: string, patch: Partial<WorkdayReminder>) => mutate(reminders.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <section className="tool-card"><div className="section-head section-head--compact"><div><span className="kicker">DESK ALARMS</span><h2>工位小闹钟</h2></div><button className="mini-button" onClick={() => mutate([...reminders, { id: `reminder-${crypto.randomUUID()}`, time: formatClock(Date.now() + 30 * 60_000), label: "提醒", message: "到点了，换个姿势继续上班。", suggestedStatus: "working", enabled: true }])}>＋ 加一条</button></div><div className="work-reminders">{reminders.map((item) => <details key={item.id}><summary><time>{item.time}</time><span><strong>{item.label}</strong><small>{item.message}</small></span><b>{item.enabled ? "已开" : "已关"}</b></summary><div className="work-reminders__edit"><label><input type="checkbox" checked={item.enabled} onChange={(event) => update(item.id, { enabled: event.target.checked })} /> 启用</label><input aria-label={`${item.label}时间`} type="time" value={item.time} onChange={(event) => update(item.id, { time: event.target.value })} /><input aria-label={`${item.label}名称`} value={item.label} onChange={(event) => update(item.id, { label: event.target.value })} /><input aria-label={`${item.label}文案`} value={item.message} onChange={(event) => update(item.id, { message: event.target.value })} /><select aria-label={`${item.label}建议状态`} value={item.suggestedStatus} onChange={(event) => update(item.id, { suggestedStatus: event.target.value as WorkStatusType })}>{STATUS_OPTIONS.filter((option) => option.selectable).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select><button onClick={() => mutate(reminders.filter((reminder) => reminder.id !== item.id))}>删除</button></div></details>)}</div><p className="tool-note">到点会在页面内提醒并自动切换状态；网页关闭后不会触发。</p></section>;
}

function fireNotification(title: string, body: string) {
  if (typeof Notification !== "undefined" && Notification.permission === "granted") new Notification(title, { body });
}

function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatClock(ms: number) { return new Date(ms).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }); }
function toLocalInput(ms: number) { const date = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000); return date.toISOString().slice(0, 16); }
function readableError(error: unknown) { return error instanceof StorageError || error instanceof Error ? error.message : "操作失败，请重试"; }
