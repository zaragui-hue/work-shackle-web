import { clockMs } from "../../domain/workday";

export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return [Math.floor(seconds / 3600), Math.floor(seconds % 3600 / 60), seconds % 60]
    .map((value) => String(value).padStart(2, "0")).join(":");
}

export function formatClock(ms: number) {
  return new Date(ms).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function toLocalInput(ms: number) {
  const date = new Date(ms - new Date(ms).getTimezoneOffset() * 60_000);
  return date.toISOString().slice(0, 16);
}

export function workdayProgress(schedule: { workDate: string; start: string; end: string }, nowMs: number) {
  const start = clockMs(schedule.workDate, schedule.start);
  const end = clockMs(schedule.workDate, schedule.end);
  if (end <= start) return 0;
  return Math.max(0, Math.min(1, (nowMs - start) / (end - start)));
}

export function countdownHeadline(phase: "before_start" | "working" | "after_end", progress: number, overtime = false, finished = false) {
  if (phase === "before_start") return "离开工还有";
  if (phase === "after_end") return overtime ? "正在加班" : finished ? "今天已经下班" : "到点了，走还是卷？";
  if (progress < .25) return "离下班还早，先把今天骗过去";
  if (progress < .5) return "工位坐稳，释放正在路上";
  if (progress < .75) return "已经熬过一半，别在这时散架";
  if (progress < .9) return "下班开始有轮廓了";
  return "再撑一下，门禁快拦不住你了";
}
