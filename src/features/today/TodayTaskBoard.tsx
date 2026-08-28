import type { Task, TaskStatus, TodayTasks } from "../../domain/model";
import { formatClock } from "./todayPresentation";
import "./TodayTaskBoard.css";

const statusLabels: Record<TaskStatus, string> = { not_started: "未开始", in_progress: "进行中", paused: "已暂停", waiting: "等待中", completed: "已完成", cancelled: "已取消" };

export function TodayTaskBoard({ today, nowMs, onCreate, onEdit, onPostpone, onStatus, onPriority }: {
  today: TodayTasks;
  nowMs: number;
  onCreate: () => void;
  onEdit: (task: Task) => void;
  onPostpone: (task: Task) => void;
  onStatus: (task: Task, status: TaskStatus) => void;
  onPriority: (task: Task, priority: number) => void;
}) {
  return (
    <section className="today-tasks">
      <header className="today-tasks__header"><div><span className="kicker">TODAY TASKS / RECEIPT</span><h2>今天这些破事</h2></div><div><span className="today-tasks__badge">今日清单</span><button className="button button--primary" onClick={onCreate}>＋ 新建任务</button></div></header>
      <TaskSection title="正在发生" empty="暂时没人往你工位扔活，建议保持低调。" tasks={today.formalTasks} nowMs={nowMs} onEdit={onEdit} onPostpone={onPostpone} onStatus={onStatus} onPriority={onPriority} />
      {today.overdueTasks.length ? <TaskSection title="昨日烂尾现场" tone="danger" tasks={today.overdueTasks} nowMs={nowMs} onEdit={onEdit} onPostpone={onPostpone} onStatus={onStatus} onPriority={onPriority} /> : null}
      {today.completedTodayTasks.length ? <details className="today-tasks__completed"><summary>✓ 今天已经搞定 {today.completedTodayTasks.length} 件事</summary><TaskSection title="" tasks={today.completedTodayTasks} nowMs={nowMs} onEdit={onEdit} onPostpone={onPostpone} onStatus={onStatus} onPriority={onPriority} /></details> : null}
    </section>
  );
}

function TaskSection({ title, empty, tone, tasks, nowMs, onEdit, onPostpone, onStatus, onPriority }: { title: string; empty?: string; tone?: "danger"; tasks: Task[]; nowMs: number; onEdit: (task: Task) => void; onPostpone: (task: Task) => void; onStatus: (task: Task, status: TaskStatus) => void; onPriority: (task: Task, priority: number) => void }) {
  return <section className={`task-section${tone ? ` task-section--${tone}` : ""}`}>{title ? <header><h3>{title}</h3><span>{tasks.length}</span></header> : null}{tasks.length === 0 ? <div className="task-empty"><strong>暂无工单</strong><p>{empty}</p></div> : <div className="task-list">{tasks.map((task, index) => <TaskCard key={task.id} task={task} ticket={String(index + 1).padStart(2, "0")} nowMs={nowMs} onEdit={() => onEdit(task)} onPostpone={() => onPostpone(task)} onStatus={(status) => onStatus(task, status)} onPriority={(priority) => onPriority(task, priority)} />)}</div>}</section>;
}

function TaskCard({ task, ticket, nowMs, onEdit, onPostpone, onStatus, onPriority }: { task: Task; ticket: string; nowMs: number; onEdit: () => void; onPostpone: () => void; onStatus: (status: TaskStatus) => void; onPriority: (priority: number) => void }) {
  const terminal = task.status === "completed" || task.status === "cancelled";
  const progress = task.deadlineAtMs ? Math.max(0, Math.min(100, ((nowMs - task.plannedAtMs) / Math.max(1, task.deadlineAtMs - task.plannedAtMs)) * 100)) : 0;
  return (
    <article className={`task-ticket task-ticket--p${task.priority}${terminal ? " task-ticket--terminal" : ""}`}>
      <button className="task-ticket__main" onClick={onEdit} aria-label={`查看任务：${task.title}`}>
        <div className="task-ticket__meta"><span>NO.{ticket}</span><time>{formatClock(task.plannedAtMs)}</time><small>{task.deadlineAtMs ? `DDL ${formatClock(task.deadlineAtMs)}` : "无 DDL"}</small></div>
        <div className="task-ticket__body"><div><span className="task-ticket__priority">P{task.priority}</span><h4>{task.title}</h4></div>{task.note ? <p>{task.note}</p> : null}{task.deadlineAtMs ? <div className="task-ticket__progress"><span style={{ width: `${progress}%` }} /></div> : null}</div>
      </button>
      <div className="task-ticket__actions">
        {terminal ? <strong>{statusLabels[task.status]}</strong> : <>
          <label><span className="sr-only">{task.title}优先级</span><select aria-label={`${task.title}优先级`} value={task.priority} onChange={(event) => onPriority(Number(event.target.value))}><option value={3}>P3 紧急</option><option value={2}>P2 重要</option><option value={1}>P1 普通</option></select></label>
          <label><span className="sr-only">{task.title}状态</span><select aria-label={`${task.title}状态`} value={task.status} onChange={(event) => onStatus(event.target.value as TaskStatus)}><option value="not_started">未开始</option><option value="in_progress">进行中</option><option value="paused">暂停</option><option value="waiting">等待</option><option value="completed">完成</option><option value="cancelled">取消</option></select></label>
          {task.deadlineAtMs ? <button onClick={onPostpone}>申请延期</button> : null}
        </>}
      </div>
    </article>
  );
}
