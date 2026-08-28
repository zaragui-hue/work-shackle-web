import { useState } from "react";
import type { Task } from "../../domain/model";
import { toLocalInput } from "../today/todayPresentation";
import "./WebPostponeDialog.css";

export function WebPostponeDialog({ task, onClose, onSave }: { task: Task; onClose: () => void; onSave: (deadline: number, reason: string) => void }) {
  const [deadline, setDeadline] = useState(toLocalInput((task.deadlineAtMs ?? Date.now()) + 24 * 60 * 60 * 1000));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const submit = () => {
    const deadlineMs = new Date(deadline).getTime();
    if (!Number.isFinite(deadlineMs) || deadlineMs <= (task.deadlineAtMs ?? 0)) return setError("新 DDL 必须晚于原 DDL");
    if (!reason.trim()) return setError("请填写延期原因");
    onSave(deadlineMs, reason);
  };
  return <div className="web-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="web-modal" role="dialog" aria-modal="true" aria-labelledby="postpone-title"><button className="web-modal__close" aria-label="关闭" onClick={onClose}>×</button><span className="kicker">DDL CONTROL / APPLY</span><h2 id="postpone-title">申请延期</h2><p className="web-modal__task">{task.title}</p><label className="field"><span>新 DDL</span><input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} /></label><label className="field"><span>延期原因</span><textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="为什么这件事还不能结束" /></label>{error ? <p className="web-modal__error" role="alert">{error}</p> : null}<footer><button className="button button--ghost" onClick={onClose}>取消</button><button className="button button--primary" onClick={submit}>确认延期</button></footer></section></div>;
}
