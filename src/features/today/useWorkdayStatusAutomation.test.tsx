import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useMemo, useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentWorkStatus,
  listWorkStatuses,
  switchWorkStatus,
} from "../../services/tauri/workStatus";
import { WorkStatusProvider } from "./WorkStatusContext";
import { useWorkdayStatusAutomation } from "./useWorkdayStatusAutomation";
import type { WorkdayReminder } from "./workdayReminders";

vi.mock("../../services/tauri/workStatus", async () => {
  const actual = await vi.importActual<typeof import("../../services/tauri/workStatus")>(
    "../../services/tauri/workStatus",
  );
  return {
    ...actual,
    listWorkStatuses: vi.fn(),
    getCurrentWorkStatus: vi.fn(),
    switchWorkStatus: vi.fn(),
  };
});

const reminder: WorkdayReminder = {
  id: "meeting-1400",
  time: "14:00",
  label: "开会",
  message: "职业假笑准备。",
  suggestedStatus: "meeting",
  enabled: true,
};

const working = {
  recordId: "r1",
  statusType: "working",
  emoji: "🧱",
  name: "工作中",
  displayCopy: "班味加载中。",
  workDate: "2026-08-24",
  startAtMs: 1,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Harness() {
  const [active, setActive] = useState<WorkdayReminder | null>(reminder);
  const manager = useMemo(() => ({
    reminders: [reminder],
    activeReminder: active,
    addReminder: () => undefined,
    updateReminder: () => undefined,
    removeReminder: () => undefined,
    dismissActive: () => setActive(null),
    completeActive: () => setActive(null),
  }), [active]);
  const automation = useWorkdayStatusAutomation(manager);
  return (
    <div>
      {automation.notice ? <span>{automation.notice.title}</span> : null}
      {automation.retry ? <button onClick={automation.retry}>重试</button> : null}
    </div>
  );
}

function renderHarness() {
  vi.mocked(listWorkStatuses).mockResolvedValue([]);
  vi.mocked(getCurrentWorkStatus).mockResolvedValue(working);
  return render(<WorkStatusProvider><Harness /></WorkStatusProvider>);
}

describe("useWorkdayStatusAutomation", () => {
  it("switches a due reminder once without a success notice", async () => {
    vi.mocked(switchWorkStatus).mockResolvedValue({
      ...working,
      recordId: "r2",
      statusType: "meeting",
      emoji: "💻",
      name: "会议中",
    });
    renderHarness();

    await waitFor(() => expect(switchWorkStatus).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(/已自动切换/)).toBeNull();
  });

  it("stops after failure and allows a manual retry", async () => {
    vi.mocked(switchWorkStatus).mockRejectedValueOnce({ code: "DATABASE_ERROR", details: {} });
    renderHarness();

    expect(await screen.findByText("状态没切过去，工位拒绝配合")).toBeTruthy();
    expect(switchWorkStatus).toHaveBeenCalledTimes(1);

    vi.mocked(switchWorkStatus).mockResolvedValue({
      ...working,
      statusType: "meeting",
      emoji: "💻",
      name: "会议中",
    });
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => expect(switchWorkStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.queryByText("状态没切过去，工位拒绝配合")).toBeNull();
    });
    expect(screen.queryByText(/已自动切换/)).toBeNull();
    expect(screen.queryByRole("button", { name: "重试" })).toBeNull();
  });
});
