import { describe, expect, it } from "vitest";

import { resolveBusyLevel } from "./busyLevel";

describe("resolveBusyLevel", () => {
  it.each([
    [0, "🫧", "空闲"],
    [1, "🌿", "松弛"],
    [2, "🌿", "松弛"],
    [3, "🙂", "正常"],
    [5, "🙂", "正常"],
    [6, "😵", "有点忙"],
    [8, "😵", "有点忙"],
    [9, "🥵", "很忙"],
    [12, "🥵", "很忙"],
    [13, "🤯", "爆满"],
    [99, "🤯", "爆满"],
  ] as const)("maps count %i to %s %s", (taskCount, emoji, name) => {
    const level = resolveBusyLevel(taskCount);
    expect(level.emoji).toBe(emoji);
    expect(level.name).toBe(name);
  });

  it("treats negative counts as idle", () => {
    const level = resolveBusyLevel(-3);
    expect(level.emoji).toBe("🫧");
    expect(level.name).toBe("空闲");
  });
});
