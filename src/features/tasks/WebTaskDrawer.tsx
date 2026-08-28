import { useState, type FormEvent } from "react";
import type { Task, TaskInput, WebData } from "../../domain/model";
import { toLocalInput } from "../today/todayPresentation";
import "./WebTaskDrawer.css";

export function WebTaskDrawer({ mode, task, data, onClose, onSave }: { mode: "create" | "edit"; task?: Task; data: WebData; onClose: () => void; onSave: (input: TaskInput) => void }) {
  const existingReminders = task ? data.taskReminders.filter((item) => item.taskId === task.id) : [];
  const [title, setTitle] = useState(task?.title ?? "");
  const [note, setNote] = useState(task?.note ?? "");
  const [planned, setPlanned] = useState(toLocalInput(task?.plannedAtMs ?? Date.now()));
  const [deadline, setDeadline] = useState(task?.deadlineAtMs ? toLocalInput(task.deadlineAtMs) : "");
  const [priority, setPriority] = useState(task?.priority ?? 1);
  const [reminders, setReminders] = useState(existingReminders.map((item) => ({ remindAt: toLocalInput(item.remindAtMs), message: item.message ?? "" })));
  const [error, setError] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const input: TaskInput = { title, note, plannedAtMs: new Date(planned).getTime(), deadlineAtMs: deadline ? new Date(deadline).getTime() : undefined, priority, reminders: reminders.map((item) => ({ remindAtMs: new Date(item.remindAt).getTime(), message: item.message })) };
    if (!title.trim()) return setError("任务名称不能为空");
    if (!Number.isFinite(input.plannedAtMs)) return setError("请选择有效的开始时间");
    if (input.deadlineAtMs !== undefined && input.deadlineAtMs < input.plannedAtMs) return setError("完成时间不能早于开始时间");
    setError("");
    onSave(input);
  };
  return (
    <div className="drawer-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="task-drawer" role="dialog" aria-modal="true" aria-labelledby="task-drawer-title">
        <header><div><span className="kicker">TASK FILE / WEB</span><h2 id="task-drawer-title">{mode === "create" ? "新建任务" : "编辑任务"}</h2></div><button aria-label="关闭" onClick={onClose}>×</button></header>
        <form onSubmit={submit}>
          <div className="task-drawer__body">
            <label className="field"><span>任务名称</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="这次又是什么活" /></label>
            <label className="field"><span>任务备注</span><textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="补充背景、交付物或内心遗言" /></label>
            <div className="task-drawer__time"><label className="field"><span>开始时间</span><input type="datetime-local" value={planned} onChange={(event) => setPlanned(event.target.value)} /></label><label className="field"><span>完成时间 / DDL</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label></div>
            <label className="field"><span>优先级</span><select value={priority} onChange={(event) => setPriority(Number(event.target.value))}><option value={1}>P1 普通</option><option value={2}>P2 重要</option><option value={3}>P3 紧急</option></select></label>
            <section className="task-drawer__reminders"><header><strong>任务提醒</strong>{reminders.length < 3 ? <button type="button" onClick={() => setReminders((items) => [...items, { remindAt: planned, message: "" }])}>＋ 加提醒</button> : null}</header>{reminders.map((item, index) => <div key={index}><input aria-label={`提醒时间 ${index + 1}`} type="datetime-local" value={item.remindAt} onChange={(event) => setReminders((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, remindAt: event.target.value } : value))} /><input aria-label={`提醒文案 ${index + 1}`} value={item.message} onChange={(event) => setReminders((items) => items.map((value, itemIndex) => itemIndex === index ? { ...value, message: event.target.value } : value))} placeholder="提醒文案" /><button type="button" aria-label={`删除提醒 ${index + 1}`} onClick={() => setReminders((items) => items.filter((_, itemIndex) => itemIndex !== index))}>×</button></div>)}</section>
            {error ? <p className="task-drawer__error" role="alert">{error}</p> : null}
          </div>
          <footer><button type="button" className="button button--ghost" onClick={onClose}>取消</button><button className="button button--primary" type="submit">保存任务</button></footer>
        </form>
      </section>
    </div>
  );
}
