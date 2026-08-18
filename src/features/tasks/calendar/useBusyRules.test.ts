import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { notifyBusyRulesUpdated } from "../../../services/tauri/busyRules";
import { useBusyRules } from "./useBusyRules";

const mockGetBusyRules = vi.fn();

vi.mock("../../../services/tauri/busyRules", async () => {
  const actual = await vi.importActual<typeof import("../../../services/tauri/busyRules")>(
    "../../../services/tauri/busyRules",
  );
  return {
    ...actual,
    getBusyRules: (...args: unknown[]) => mockGetBusyRules(...args),
  };
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("useBusyRules", () => {
  it("loads latest busy rules for calendar", async () => {
    mockGetBusyRules.mockResolvedValue([
      {
        id: "busy-1",
        minTasks: 0,
        maxTasks: null,
        emoji: "😎",
        name: "自定义",
        sortOrder: 0,
        messages: [{ id: "msg-1", content: "新文案" }],
      },
    ]);

    const { result } = renderHook(() => useBusyRules());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.levels[0]).toEqual({
      emoji: "😎",
      name: "自定义",
      minTasks: 0,
      maxTasks: null,
    });
  });

  it("refetches when busy rules are updated", async () => {
    mockGetBusyRules.mockResolvedValue([
      {
        id: "busy-1",
        minTasks: 0,
        maxTasks: null,
        emoji: "🙂",
        name: "旧规则",
        sortOrder: 0,
        messages: [{ id: "msg-1", content: "旧" }],
      },
    ]);

    const { result } = renderHook(() => useBusyRules());

    await waitFor(() => {
      expect(result.current.levels[0]?.name).toBe("旧规则");
    });

    mockGetBusyRules.mockResolvedValue([
      {
        id: "busy-2",
        minTasks: 0,
        maxTasks: null,
        emoji: "🔥",
        name: "新规则",
        sortOrder: 0,
        messages: [{ id: "msg-2", content: "新" }],
      },
    ]);

    notifyBusyRulesUpdated();

    await waitFor(() => {
      expect(result.current.levels[0]?.name).toBe("新规则");
    });
    expect(mockGetBusyRules.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});
