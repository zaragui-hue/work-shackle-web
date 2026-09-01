import type { ActiveOvertime } from "../../services/tauri/overtime";
import type { WorkSchedule } from "../../services/tauri/settings";
import type { Task } from "../../services/tauri/tasks";
import type { CurrentWorkStatus } from "../../services/tauri/workStatus";
import { parseClockTimeOnDate } from "../today/workCountdown";
import type { DynamicAppIconSnapshot } from "./dynamicAppIconState";

const ACTIONABLE_STATUSES = new Set<Task["status"]>([
  "not_started",
  "in_progress",
  "waiting",
]);

export type DynamicAppIconFacts = {
  nowMs: number;
  tasks: Task[];
  schedule: WorkSchedule | null;
  activeOvertime: ActiveOvertime | null;
  currentStatus: CurrentWorkStatus | null;
};

export function buildDynamicAppIconSnapshot(
  facts: DynamicAppIconFacts,
): DynamicAppIconSnapshot {
  const scheduleDay = facts.schedule
    ? parseClockTimeOnDate(facts.schedule.workDate, "12:00").getDay()
    : null;
  const ordinaryWorkday = scheduleDay != null && scheduleDay !== 0 && scheduleDay !== 6;
  const deadlines = facts.tasks
    .filter((task) => ACTIONABLE_STATUSES.has(task.status))
    .flatMap((task) => task.deadlineAtMs == null ? [] : [task.deadlineAtMs]);

  return {
    nowMs: facts.nowMs,
    workEndAtMs: facts.schedule && ordinaryWorkday
      ? parseClockTimeOnDate(
        facts.schedule.workDate,
        facts.schedule.effectiveEnd,
      ).getTime()
      : undefined,
    activeOvertime: facts.activeOvertime != null,
    isWorking: facts.currentStatus != null && ordinaryWorkday,
    nearestDeadlineAtMs: deadlines.length > 0 ? Math.min(...deadlines) : undefined,
  };
}
