export type WorkCountdownPhase = "before_start" | "working" | "after_end";

export type WorkCountdownInput = {
  workDate: string;
  effectiveStart: string;
  effectiveEnd: string;
};

export type WorkCountdownDisplay = {
  phase: WorkCountdownPhase;
  primaryText: string;
  countdownText: string | null;
};

const HOUR_MS = 60 * 60 * 1000;

const WORK_COUNTDOWN_HEADLINES = {
  distant: [
    "系统提示：距离下班还远，建议先假装热爱工作",
    "工位已锁定，今日自由仍在排队加载",
    "下班节点尚未渲染，先维持人类在线状态",
    "赛博工牌持续发热，释放权限暂未下发",
  ],
  middle: [
    "班味进度过半，灵魂继续低功耗运行",
    "今日副本已刷一半，奖励是继续上班",
    "工位续费成功，自由体验版稍后开放",
    "进度条看着挺快，人生加载得另说",
  ],
  near: [
    "释放协议开始握手，请勿提前暴露笑容",
    "下班权限正在同步，工位封印已有裂纹",
    "赛博越狱进入读条，保持无事发生的表情",
    "自由信号已搜到，老板信号请继续屏蔽",
  ],
  final: [
    "关机程序已启动，肉身准备撤离",
    "门禁即将失守，请把灵魂塞回身体",
    "最后一格班味，清空后立即逃生",
    "撤离倒计时已上线，禁止临时加需求",
  ],
} as const;

type WorkCountdownCopyStage = keyof typeof WORK_COUNTDOWN_HEADLINES;

export function parseClockTimeOnDate(workDate: string, clockTime: string): Date {
  const [hours, minutes] = clockTime.split(":").map(Number);
  const [year, month, day] = workDate.split("-").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function formatHmsCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export function workCountdownHeadline(
  workDate: string,
  remainingMs: number,
  nowMs: number,
): string {
  const pool = WORK_COUNTDOWN_HEADLINES[countdownCopyStage(remainingMs)];
  const dateSeed = [...workDate].reduce(
    (sum, character) => sum + character.charCodeAt(0),
    0,
  );
  const currentHour = new Date(nowMs).getHours();
  return pool[(dateSeed + currentHour) % pool.length];
}

export function computeWorkCountdown(
  schedule: WorkCountdownInput,
  nowMs: number,
): WorkCountdownDisplay {
  const startAt = parseClockTimeOnDate(schedule.workDate, schedule.effectiveStart);
  const endAt = parseClockTimeOnDate(schedule.workDate, schedule.effectiveEnd);
  const now = nowMs;

  if (now < startAt.getTime()) {
    return {
      phase: "before_start",
      primaryText: `今天 ${schedule.effectiveStart} 开工`,
      countdownText: null,
    };
  }

  if (now >= endAt.getTime()) {
    return {
      phase: "after_end",
      primaryText: "今天已经到下班时间",
      countdownText: null,
    };
  }

  const remainingMs = endAt.getTime() - now;
  return {
    phase: "working",
    primaryText: workCountdownHeadline(schedule.workDate, remainingMs, nowMs),
    countdownText: formatHmsCountdown(remainingMs),
  };
}

function countdownCopyStage(remainingMs: number): WorkCountdownCopyStage {
  const remainingHours = remainingMs / HOUR_MS;
  if (remainingHours > 6) return "distant";
  if (remainingHours > 3) return "middle";
  if (remainingHours >= 1) return "near";
  return "final";
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}
