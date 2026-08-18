import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import {
  REMINDER_WINDOW_SHOW_EVENT,
  type ReminderWindowShowPayload,
} from "../../services/tauri/reminder";
import { useReminderWindow } from "./useReminderWindow";

const showPayload: ReminderWindowShowPayload = {
  primary: {
    kind: "system",
    taskId: "task-1",
    taskTitle: "提交方案",
    reminderKind: "ddl_30",
    deadlineSnapshotMs: 20_000,
    triggerAtMs: 12_000,
    firedAtMs: 12_000,
  },
  additionalCount: 1,
};

const listenHandlers: Array<(event: { payload: ReminderWindowShowPayload }) => void> = [];
const hideMock = vi.fn(async () => undefined);

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(
    async (
      eventName: string,
      handler: (event: { payload: ReminderWindowShowPayload }) => void,
    ) => {
      if (eventName === REMINDER_WINDOW_SHOW_EVENT) {
        listenHandlers.push(handler);
      }
      return () => {
        const index = listenHandlers.indexOf(handler);
        if (index >= 0) {
          listenHandlers.splice(index, 1);
        }
      };
    },
  ),
}));

vi.mock("@tauri-apps/api/webviewWindow", () => ({
  getCurrentWebviewWindow: () => ({
    hide: hideMock,
  }),
}));

describe("useReminderWindow", () => {
  beforeEach(() => {
    listenHandlers.length = 0;
    hideMock.mockClear();
  });

  it("registers a single listener and cleans up on unmount", async () => {
    const { unmount } = renderHook(() => useReminderWindow());
    await waitFor(() => {
      expect(listenHandlers).toHaveLength(1);
    });

    unmount();
    await waitFor(() => {
      expect(listenHandlers).toHaveLength(0);
    });
  });

  it("updates payload when reminder window show event arrives", async () => {
    const { result } = renderHook(() => useReminderWindow());
    await waitFor(() => {
      expect(listenHandlers).toHaveLength(1);
    });

    act(() => {
      listenHandlers[0]?.({ payload: showPayload });
    });

    expect(result.current.payload).toEqual(showPayload);
  });

  it("dismiss hides the window without mutating payload semantics beyond UI state", async () => {
    const { result } = renderHook(() => useReminderWindow());
    await waitFor(() => {
      expect(listenHandlers).toHaveLength(1);
    });

    act(() => {
      listenHandlers[0]?.({ payload: showPayload });
    });

    await act(async () => {
      await result.current.dismiss();
    });

    expect(hideMock).toHaveBeenCalledTimes(1);
    expect(result.current.payload).toBeNull();
  });
});
