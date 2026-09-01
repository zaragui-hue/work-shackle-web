import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { WorkSchedule } from "../../services/tauri/settings";
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

const schedule: WorkSchedule = {
  workDate: "2026-08-24",
  defaultStart: "09:00",
  defaultEnd: "18:00",
  effectiveStart: "09:00",
  effectiveEnd: "18:00",
  hasTodayOverride: false,
};

const meeting: WorkdayReminder = {
  id: "meeting-1400",
  startTime: "14:00",
  endTime: "15:00",
  statusType: "meeting",
  createdAtMs: 1,
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

function Harness({
  active,
  nowMs,
}: {
  active: WorkdayReminder | null;
  nowMs: number;
}) {
  const manager = {
    reminders: active ? [active] : [],
    activeReminder: active,
    nowMs,
    draft: null,
    storageError: null,
    startAdd: () => undefined,
    startEdit: () => undefined,
    updateDraft: () => undefined,
    saveDraft: () => undefined,
    cancelDraft: () => undefined,
    deleteDraftReminder: () => undefined,
    clearAll: () => true,
  };
  const automation = useWorkdayStatusAutomation(manager, schedule);
  return (
    <div>
      {automation.notice ? <span>{automation.notice.title}</span> : null}
      {automation.retry ? <button onClick={automation.retry}>重试</button> : null}
    </div>
  );
}

function setup(
  active: WorkdayReminder | null,
  nowMs: number,
  useDefaultSwitchMock = true,
) {
  vi.mocked(listWorkStatuses).mockResolvedValue([]);
  vi.mocked(getCurrentWorkStatus).mockResolvedValue(working);
  if (useDefaultSwitchMock) {
    vi.mocked(switchWorkStatus).mockImplementation(async (statusType) => ({
      ...working,
      recordId: `r-${statusType}`,
      statusType,
      name: statusType,
    }));
  }
  return render(
    <WorkStatusProvider>
      <Harness active={active} nowMs={nowMs} />
    </WorkStatusProvider>,
  );
}

describe("useWorkdayStatusAutomation", () => {
  it("enters a range and restores focus when it ends", async () => {
    const during = new Date(2026, 7, 24, 14, 30).getTime();
    const view = setup(meeting, during);
    await waitFor(() => expect(switchWorkStatus).toHaveBeenCalledWith("meeting"));

    view.rerender(
      <WorkStatusProvider>
        <Harness active={null} nowMs={new Date(2026, 7, 24, 15, 0).getTime()} />
      </WorkStatusProvider>,
    );
    await waitFor(() => expect(switchWorkStatus).toHaveBeenCalledWith("focus_brick"));
  });

  it("lets an active range win in the prepare window, then prepares to leave", async () => {
    const view = setup(meeting, new Date(2026, 7, 24, 17, 45).getTime());
    await waitFor(() => expect(switchWorkStatus).toHaveBeenCalledWith("meeting"));
    expect(switchWorkStatus).not.toHaveBeenCalledWith("preparing_leave");

    view.rerender(
      <WorkStatusProvider>
        <Harness active={null} nowMs={new Date(2026, 7, 24, 17, 50).getTime()} />
      </WorkStatusProvider>,
    );
    await waitFor(() => expect(switchWorkStatus).toHaveBeenCalledWith("preparing_leave"));
  });

  it("shows the existing retry path when a status switch fails", async () => {
    vi.mocked(listWorkStatuses).mockResolvedValue([]);
    vi.mocked(getCurrentWorkStatus).mockResolvedValue(working);
    vi.mocked(switchWorkStatus).mockRejectedValueOnce({ code: "DATABASE_ERROR", details: {} });
    setup(meeting, new Date(2026, 7, 24, 14, 30).getTime(), false);

    expect(await screen.findByText("状态没切过去，工位拒绝配合")).toBeTruthy();
    vi.mocked(switchWorkStatus).mockResolvedValue({ ...working, statusType: "meeting" });
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(switchWorkStatus).toHaveBeenCalledTimes(2));
  });
});
