import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  confirmNormalOffWork,
  getWorkEndState,
  type WorkEndState,
} from "../../services/tauri/workEndDecision";
import { useWorkEndDecision } from "./useWorkEndDecision";

vi.mock("../../services/tauri/workEndDecision", () => ({
  getWorkEndState: vi.fn(),
  confirmNormalOffWork: vi.fn(),
}));

const pendingState: WorkEndState = {
  workDate: "2026-08-14",
  effectiveEnd: "18:30",
  phase: "pending_decision",
  displayCopy: null,
};

const normalOffState: WorkEndState = {
  workDate: "2026-08-14",
  effectiveEnd: "18:30",
  phase: "normal_off",
  displayCopy: "已下班。工作消息从现在开始酌情理解。",
};

describe("useWorkEndDecision", () => {
  beforeEach(() => {
    vi.mocked(getWorkEndState).mockReset();
    vi.mocked(confirmNormalOffWork).mockReset();
  });

  it("loads work end state on mount", async () => {
    vi.mocked(getWorkEndState).mockResolvedValue(pendingState);

    const { result } = renderHook(() => useWorkEndDecision());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.state).toEqual(pendingState);
    expect(result.current.error).toBeNull();
  });

  it("updates state after confirming normal off", async () => {
    vi.mocked(getWorkEndState).mockResolvedValue(pendingState);
    vi.mocked(confirmNormalOffWork).mockResolvedValue(normalOffState);

    const { result } = renderHook(() => useWorkEndDecision());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    await result.current.confirmNormalOff();

    await waitFor(() => {
      expect(result.current.state).toEqual(normalOffState);
    });
    expect(result.current.confirming).toBe(false);
  });
});
