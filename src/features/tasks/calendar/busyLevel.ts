export type BusyLevel = {
  emoji: string;
  name: string;
  minTasks: number;
  maxTasks: number | null;
};

/** Frozen PRD default busy tiers; TASK-0705/0706 will replace with DB-backed rules. */
export const DEFAULT_BUSY_LEVELS: readonly BusyLevel[] = [
  { minTasks: 0, maxTasks: 0, emoji: "🫧", name: "空闲" },
  { minTasks: 1, maxTasks: 2, emoji: "🌿", name: "松弛" },
  { minTasks: 3, maxTasks: 5, emoji: "🙂", name: "正常" },
  { minTasks: 6, maxTasks: 8, emoji: "😵", name: "有点忙" },
  { minTasks: 9, maxTasks: 12, emoji: "🥵", name: "很忙" },
  { minTasks: 13, maxTasks: null, emoji: "🤯", name: "爆满" },
] as const;

export function resolveBusyLevel(taskCount: number): BusyLevel {
  const normalized = Math.max(0, Math.floor(taskCount));

  for (const level of DEFAULT_BUSY_LEVELS) {
    if (
      normalized >= level.minTasks &&
      (level.maxTasks === null || normalized <= level.maxTasks)
    ) {
      return level;
    }
  }

  return DEFAULT_BUSY_LEVELS[DEFAULT_BUSY_LEVELS.length - 1];
}

export function formatTaskCountLabel(taskCount: number): string {
  return `${Math.max(0, Math.floor(taskCount))} 个任务`;
}

export function formatBusyStateLabel(level: BusyLevel): string {
  return `${level.emoji} ${level.name}`;
}
