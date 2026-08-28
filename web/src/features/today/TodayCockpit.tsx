import type { OvertimeRecord, WorkStatusRecord, WorkStatusType } from "../../domain/model";
import { STATUS_OPTIONS } from "../../domain/defaultData";
import spriteUrl from "../../assets/workhorse/workhorse-running-sprite-v1.png";
import smileUrl from "../../assets/workhorse/reactions/professional-smile-v2.png";
import overtimeUrl from "../../assets/workhorse/reactions/overtime-stone-v2.png";
import powerDownUrl from "../../assets/workhorse/reactions/power-down-v1.png";
import { countdownHeadline, formatDuration, workdayProgress } from "./todayPresentation";
import "./TodayCockpit.css";

type Schedule = { workDate: string; start: string; end: string };
type Count = { phase: "before_start" | "working" | "after_end"; remainingMs: number };

export function TodayCockpit({ schedule, count, nowMs, status, overtime, decision, onStatus, onNormalOff, onStartOvertime, onEndOvertime }: {
  schedule: Schedule;
  count: Count;
  nowMs: number;
  status?: WorkStatusRecord;
  overtime?: OvertimeRecord;
  decision?: { kind: "normal" | "overtime" };
  onStatus: (status: WorkStatusType) => void;
  onNormalOff: () => void;
  onStartOvertime: () => void;
  onEndOvertime: () => void;
}) {
  const progress = workdayProgress(schedule, nowMs);
  const percent = Math.round(progress * 100);
  const statusOption = STATUS_OPTIONS.find((option) => option.id === status?.statusType);
  const finished = decision?.kind === "normal";
  const time = count.phase === "after_end" ? overtime ? formatDuration(nowMs - overtime.startAtMs) : "00:00:00" : formatDuration(count.remainingMs);
  const [hours, minutes, seconds] = time.split(":");

  return (
    <>
      <section className="status-cockpit" aria-label="今日下班进度">
        <div className="status-cockpit__work">
          <div className="work-countdown__heading-row">
            <div><p className="work-countdown__kicker"><span />LIVE / 距离释放</p><h2>{countdownHeadline(count.phase, progress, Boolean(overtime), finished)}</h2></div>
            <strong className="work-countdown__percent">班味 {percent}%</strong>
          </div>
          <div className="work-countdown__clock" aria-label={time}>
            <span className="work-countdown__hours">{hours}<small>时</small></span>
            <span>{minutes}<small>分</small></span><span>{seconds}<small>秒</small></span>
          </div>
          <div className="work-countdown__track" role="progressbar" aria-label="今日工作进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <i style={{ width: `${percent}%` }} /><b>下班</b>
            <span className="workhorse-runner" style={{ left: `${percent}%`, transform: `translateX(-${percent}%)` }} aria-label="正在工位奔跑的马"><span style={{ backgroundImage: `url(${spriteUrl})` }} /></span>
          </div>
          <footer><span>{schedule.start} 上班</span><span>{schedule.end} 下班</span></footer>
        </div>
        <aside className="status-cockpit__reaction" aria-label="当前工作状态">
          <div className="status-cockpit__status-row"><span>当前精神档位</span><label><span className="sr-only">当前状态</span><select aria-label="当前状态" value={status?.statusType ?? ""} onChange={(event) => onStatus(event.target.value as WorkStatusType)}><option value="" disabled>选择状态</option>{STATUS_OPTIONS.filter((item) => item.selectable).map((item) => <option key={item.id} value={item.id}>{item.emoji} {item.name}</option>)}</select></label></div>
          <div className="status-cockpit__meme"><span className="status-cockpit__meme-mark" aria-hidden="true">!</span><img src={finished ? powerDownUrl : overtime ? overtimeUrl : smileUrl} alt="" /><div className="status-cockpit__speech"><strong>{statusOption?.emoji ?? "·"} {statusOption?.name ?? "状态待录入"}</strong><p>{status?.displayCopy ?? "选个状态，今天的工位广播就开张。"}</p></div></div>
        </aside>
      </section>
      {count.phase === "after_end" && !overtime && !decision ? <section className="decision-card"><div><span className="kicker">WORKDAY DECISION</span><h3>今天准备怎么收场？</h3><p>正常下班会结束当前状态；加班则继续计算工位时长。</p></div><div><button className="button button--primary" onClick={onNormalOff}>正常下班</button><button className="button button--dark" onClick={onStartOvertime}>开始加班</button></div></section> : null}
      {overtime ? <section className="decision-card decision-card--night"><div><span className="kicker">OVERTIME ACTIVE</span><h3>月亮值班，你也值班</h3><p>已加班 {formatDuration(nowMs - overtime.startAtMs)}，别忘了给今天画句号。</p></div><button className="button button--light" onClick={onEndOvertime}>结束加班</button></section> : null}
    </>
  );
}
