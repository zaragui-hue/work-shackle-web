import { describe, expect, it } from "vitest";

import {
  createEmptyMessage,
  fromBusyLevelRules,
  toSavePayload,
  trimMessages,
} from "./busyRuleForm";

describe("busyRuleForm", () => {
  it("loads default-like rules into form values", () => {
    const values = fromBusyLevelRules([
      {
        id: "busy-1",
        minTasks: 0,
        maxTasks: 0,
        emoji: "🫧",
        name: "空闲",
        messages: [{ id: "msg-1", content: "今天居然没事" }],
      },
      {
        id: "busy-2",
        minTasks: 13,
        maxTasks: null,
        emoji: "🤯",
        name: "爆满",
        messages: [{ id: "msg-2", content: "今天别找我" }],
      },
    ]);

    expect(values.levels).toHaveLength(2);
    expect(values.levels[1].maxTasks).toBe("");
  });

  it("trims blank messages before save", () => {
    const payload = toSavePayload({
      levels: [
        {
          clientId: "level-1",
          minTasks: 0,
          maxTasks: 2,
          emoji: "🙂",
          name: "正常",
          messages: [
            { clientId: "msg-1", content: "  正常营业  " },
            { clientId: "msg-2", content: "   " },
          ],
        },
        {
          clientId: "level-2",
          minTasks: 3,
          maxTasks: "",
          emoji: "🤯",
          name: "爆满",
          messages: [createEmptyMessage()],
        },
      ],
    });

    expect(payload.levels[0].messages).toEqual(["正常营业"]);
    expect(payload.levels[1].maxTasks).toBeNull();
  });

  it("does not include whitespace-only messages", () => {
    expect(trimMessages([{ clientId: "1", content: "  " }])).toEqual([]);
  });
});
