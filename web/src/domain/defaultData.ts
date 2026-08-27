import type { WebData, WorkStatusType, WorkdayReminder } from "./model";

export const STATUS_OPTIONS: { id: WorkStatusType; emoji: string; name: string; copy: string; selectable: boolean }[] = [
  { id: "working", emoji: "🧱", name: "工作中", copy: "键盘已经热起来了，今日份班味加载中。", selectable: true },
  { id: "focus_brick", emoji: "🎧", name: "专注搬砖", copy: "耳机一戴，世界之外只有需求和代码。", selectable: true },
  { id: "meeting", emoji: "💻", name: "会议中", copy: "人还在会议室，灵魂可能已经去午睡了。", selectable: true },
  { id: "urgent_insert", emoji: "🚨", name: "临时插单", copy: "计划永远赶不上突然弹出的那条消息。", selectable: true },
  { id: "chased_by_requirements", emoji: "🏃", name: "被需求追杀", copy: "需求在身后，DDL 在前方，我在中间硬撑。", selectable: true },
  { id: "slacking", emoji: "🐟", name: "摸鱼中", copy: "工作暂停一下，人生加载一会儿。", selectable: true },
  { id: "gossip", emoji: "👂", name: "八卦一下", copy: "耳朵已上线，生产力暂时离线。", selectable: true },
  { id: "drinking", emoji: "☕", name: "喝点东西", copy: "先续一口命，再回去和工位对线。", selectable: true },
  { id: "lunch", emoji: "🍚", name: "午餐中", copy: "干饭是当前唯一高优先级任务。", selectable: true },
  { id: "nap", emoji: "💤", name: "午休续命", copy: "闭眼五分钟，重启一下午。", selectable: true },
  { id: "daydream", emoji: "🫠", name: "发会儿呆", copy: "脑子已下班，身体还在公司。", selectable: true },
  { id: "preparing_leave", emoji: "👜", name: "准备下班", copy: "文件在保存，灵魂已在门口。", selectable: true },
  { id: "overtime", emoji: "🌙", name: "加班中", copy: "夜色已深，工位还在发光。", selectable: false },
];

export const DEFAULT_REMINDERS: WorkdayReminder[] = [
  { id: "water-1030", time: "10:30", label: "喝水", message: "杯子还在，水呢？", suggestedStatus: "drinking", enabled: true },
  { id: "lunch-1200", time: "12:00", label: "午休", message: "先把人类基础需求处理一下。", suggestedStatus: "lunch", enabled: true },
  { id: "coffee-1500", time: "15:00", label: "续命", message: "咖啡可以续，命别全押上。", suggestedStatus: "drinking", enabled: true },
  { id: "wrap-1730", time: "17:30", label: "收尾", message: "现在接的新活，明天也不会消失。", suggestedStatus: "preparing_leave", enabled: true },
];

export function createDefaultData(nowMs = Date.now()): WebData {
  return {
    schemaVersion: 1, updatedAtMs: nowMs, tasks: [], taskReminders: [], postponements: [],
    schedule: { defaultStart: "09:30", defaultEnd: "18:00", lunchStart: "12:00", lunchEnd: "13:00", todayOverrides: {} },
    workdayReminders: DEFAULT_REMINDERS.map((item) => ({ ...item })), reminderFires: [], workStatusRecords: [],
    lunchDismissedDates: [], overtimeRecords: [], workEndDecisions: [],
  };
}
