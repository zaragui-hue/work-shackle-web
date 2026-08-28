import { STATUS_OPTIONS } from "../../domain/defaultData";
import type { WebData, WorkStatusType, WorkdayReminder } from "../../domain/model";
import { formatClock } from "./todayPresentation";
import "./WorkdayTools.css";

export type SaveState = "saved" | "saving" | "unsaved";

export function WorkdayTools({ data, endTime, saveState, saveError, onChangeEnd, onRemindersChange, onBackup, onRetrySave, onRequestNotifications }: {
  data: WebData;
  endTime: string;
  saveState: SaveState;
  saveError: string;
  onChangeEnd: (end: string) => void;
  onRemindersChange: (reminders: WorkdayReminder[]) => void;
  onBackup: () => void;
  onRetrySave: () => void;
  onRequestNotifications?: () => void;
}) {
  const update = (id: string, patch: Partial<WorkdayReminder>) => onRemindersChange(data.workdayReminders.map((item) => item.id === id ? { ...item, ...patch } : item));
  const add = () => onRemindersChange([...data.workdayReminders, { id: `reminder-${crypto.randomUUID()}`, time: formatClock(Date.now() + 30 * 60_000), label: "提醒", message: "到点了，换个姿势继续上班。", suggestedStatus: "working", enabled: true }]);
  return (
    <aside className="workday-tools">
      <section className="workday-card workday-card--pass"><span className="workday-card__number">PASS / {new Date().getFullYear()}</span><span className="kicker">WORKDAY LICENSE</span><h2>工位使用证</h2><label className="field"><span>今日下班时间</span><input type="time" value={endTime} onChange={(event) => onChangeEnd(event.target.value)} /></label><dl><div><dt>默认上班</dt><dd>{data.schedule.defaultStart}</dd></div><div><dt>默认下班</dt><dd>{data.schedule.defaultEnd}</dd></div></dl><p className="workday-card__note">今天修改的下班时间，不代表老板认可。</p></section>
      <section className="workday-card"><header><div><span className="kicker">DESK ALARMS</span><h2>工位小闹钟</h2></div><button className="mini-button" onClick={add}>＋ 加一条</button></header><div className="work-reminders">{data.workdayReminders.map((item) => <details key={item.id}><summary><time>{item.time}</time><span><strong>{item.label}</strong><small>{item.message}</small></span><b>{item.enabled ? "已开" : "已关"}</b></summary><div className="work-reminders__edit"><label><input type="checkbox" checked={item.enabled} onChange={(event) => update(item.id, { enabled: event.target.checked })} /> 启用</label><input aria-label={`${item.label}时间`} type="time" value={item.time} onChange={(event) => update(item.id, { time: event.target.value })} /><input aria-label={`${item.label}名称`} value={item.label} onChange={(event) => update(item.id, { label: event.target.value })} /><input aria-label={`${item.label}文案`} value={item.message} onChange={(event) => update(item.id, { message: event.target.value })} /><select aria-label={`${item.label}建议状态`} value={item.suggestedStatus} onChange={(event) => update(item.id, { suggestedStatus: event.target.value as WorkStatusType })}>{STATUS_OPTIONS.filter((option) => option.selectable).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select><button onClick={() => onRemindersChange(data.workdayReminders.filter((reminder) => reminder.id !== item.id))}>删除</button></div></details>)}</div><p className="workday-card__note">页面打开时按点提醒；网页关闭后不会触发。</p></section>
      <section className={`workday-card local-save local-save--${saveState}`} aria-label="本地数据状态"><span className="kicker">LOCAL FILE / WEB ONLY</span><h2>{saveState === "saved" ? "已保存到本地文件夹" : saveState === "saving" ? "正在保存" : "尚未保存"}</h2><p>{saveError || "任务和历史记录只写入你选择的文件夹，不上传云端。"}</p><div>{saveState === "unsaved" ? <button className="button button--primary" onClick={onRetrySave}>重试保存</button> : null}<button className="button button--ghost" onClick={onBackup}>立即备份</button>{onRequestNotifications ? <button className="button button--ghost" onClick={onRequestNotifications}>开启浏览器通知</button> : null}</div></section>
    </aside>
  );
}
