import type { WorkSchedule } from "../../services/tauri/settings";
import { parseClockTimeOnDate } from "./workCountdown";

export type WorkdayMood = "clear" | "power-save" | "drained" | "sprint" | "offwork";

export type WorkdayProgressState = {
  progress: number;
  mood: WorkdayMood;
  label: string;
  headline: string;
  encouragement: string;
  moodMark: string;
};

export function getWorkdayProgress(
  schedule: WorkSchedule,
  nowMs: number,
): WorkdayProgressState {
  const startAt = parseClockTimeOnDate(schedule.workDate, schedule.effectiveStart).getTime();
  const endAt = parseClockTimeOnDate(schedule.workDate, schedule.effectiveEnd).getTime();
  const progress = calculateProgress(startAt, endAt, nowMs);

  if (progress >= 100) {
    return {
      progress,
      mood: "offwork",
      label: "工位使用权到期",
      headline: "今日工位使用权已到期",
      encouragement: "谁叫你都听不见。",
      moodMark: "✓",
    };
  }
  if (progress >= 80) {
    return {
      progress,
      mood: "sprint",
      label: "最后冲刺区",
      headline: "终点就在打印机后面",
      encouragement: "别在终点前接新活。",
      moodMark: "!",
    };
  }
  if (progress >= 55) {
    return {
      progress,
      mood: "drained",
      label: "带薪耗电中",
      headline: "下班已经有了具体形状",
      encouragement: "再顶一下，别在这里交代。",
      moodMark: "汗",
    };
  }
  if (progress >= 25) {
    return {
      progress,
      mood: "power-save",
      label: "稳定省电区",
      headline: "已进入稳定耗电区",
      encouragement: "保持呼吸，工资按天算。",
      moodMark: "…",
    };
  }
  return {
    progress,
    mood: "clear",
    label: progress === 0 ? "等待开机" : "人类启动中",
    headline: progress === 0 ? "工位还没正式开机" : "今天也算顺利开机了",
    encouragement: "先别燃烧，上午还长。",
    moodMark: "○",
  };
}

function calculateProgress(startAt: number, endAt: number, nowMs: number): number {
  if (endAt <= startAt || nowMs <= startAt) {
    return 0;
  }
  if (nowMs >= endAt) {
    return 100;
  }
  return Math.round(((nowMs - startAt) / (endAt - startAt)) * 100);
}
