import { describe, expect, it } from "vitest";

import type { Task } from "../../services/tauri/tasks";
import { buildDynamicAppIconSnapshot } from "./dynamicAppIconSnapshot";

const nowMs = new Date(2026, 7, 31, 17, 0).getTime();

function task(id: string, deadlineAtMs: number, status: Task["status"]): Task {
  return {
    id,
    title: id,
    plannedAtMs: nowMs - 1_000,
    deadlineAtMs,
    priority: 2,
    status,
    createdAtMs: nowMs - 2_000,
    updatedAtMs: nowMs - 1_000,
  };
}

describe("buildDynamicAppIconSnapshot", () => {
  it("selects the nearest actionable deadline and excludes paused tasks", () => {
    const result = buildDynamicAppIconSnapshot({
      nowMs,
      tasks: [
        task("later", nowMs + 20_000, "waiting"),
        task("paused", nowMs - 50_000, "paused"),
        task("done", nowMs - 60_000, "completed"),
        task("nearest", nowMs + 10_000, "in_progress"),
      ],
      schedule: null,
      activeOvertime: null,
      currentStatus: null,
    });

    expect(result.nearestDeadlineAtMs).toBe(nowMs + 10_000);
  });

  it("parses the configured local work end and current work fact", () => {
    const result = buildDynamicAppIconSnapshot({
      nowMs,
      tasks: [],
      schedule: {
        workDate: "2026-08-31",
        defaultStart: "09:00",
        defaultEnd: "18:00",
        effectiveStart: "09:30",
        effectiveEnd: "18:30",
        hasTodayOverride: true,
      },
      activeOvertime: null,
      currentStatus: {
        recordId: "status-1",
        statusType: "meeting",
        emoji: "💻",
        name: "会议中",
        displayCopy: "meeting",
        workDate: "2026-08-31",
        startAtMs: nowMs - 1_000,
      },
    });

    expect(result.workEndAtMs).toBe(new Date(2026, 7, 31, 18, 30).getTime());
    expect(result.isWorking).toBe(true);
    expect(result.activeOvertime).toBe(false);
  });

  it("keeps weekends on ordinary time unless overtime is explicit", () => {
    const saturday = new Date(2026, 8, 5, 17, 45).getTime();
    const result = buildDynamicAppIconSnapshot({
      nowMs: saturday,
      tasks: [],
      schedule: {
        workDate: "2026-09-05",
        defaultStart: "09:00",
        defaultEnd: "18:00",
        effectiveStart: "09:00",
        effectiveEnd: "18:00",
        hasTodayOverride: false,
      },
      activeOvertime: null,
      currentStatus: null,
    });

    expect(result.workEndAtMs).toBeUndefined();
    expect(result.isWorking).toBe(false);
  });
});
