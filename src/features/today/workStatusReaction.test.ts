import { describe, expect, it } from "vitest";

import { getWorkStatusReaction } from "./workStatusReaction";

const chased = {
  recordId: "r1",
  statusType: "chased_by_requirements",
  emoji: "🏃",
  name: "被需求追杀",
  displayCopy: "需求在身后。",
  workDate: "2026-08-24",
  startAtMs: 1,
};

describe("getWorkStatusReaction", () => {
  it("returns a stable meme reaction for the same status and phase", () => {
    const first = getWorkStatusReaction(chased, "drained");
    const second = getWorkStatusReaction(chased, "drained");

    expect(first).toEqual(second);
    expect(first.copy).toMatch(/需求/);
    expect(first.mascot).toBe("offwork-run");
    expect(first.animation).toBe("run");
    expect(first.memeMark).toBe("跑");
  });

  it("falls back to server copy for an unknown status", () => {
    const reaction = getWorkStatusReaction({
      ...chased,
      statusType: "future_status",
      displayCopy: "未来状态也要上班。",
    });

    expect(reaction.copy).toBe("未来状态也要上班。");
    expect(reaction.mascot).toBe("work-neutral");
  });
});
