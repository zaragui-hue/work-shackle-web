import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  saveDefaultWorkTimes,
  saveTodayWorkOverride,
} from "../../services/tauri/settings";
import { WorkScheduleEditor } from "./WorkScheduleEditor";
import type { WorkdayReminderManager } from "./useWorkdayReminders";

vi.mock("../../services/tauri/settings", async () => {
  const actual = await vi.importActual<typeof import("../../services/tauri/settings")>(
    "../../services/tauri/settings",
  );
  return {
    ...actual,
    saveDefaultWorkTimes: vi.fn(),
    saveTodayWorkOverride: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const defaultSchedule = {
  workDate: "2026-08-19",
  defaultStart: "09:30",
  defaultEnd: "18:30",
  effectiveStart: "09:30",
  effectiveEnd: "18:30",
  hasTodayOverride: false,
};

function selectClockValue(label: string, value: string) {
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${label}：`) }));
  fireEvent.click(screen.getByRole("option", { name: value }));
}

describe("WorkScheduleEditor", () => {
  it("saves default work times from the today countdown panel", async () => {
    const onSaved = vi.fn();
    vi.mocked(saveDefaultWorkTimes).mockResolvedValue({
      ...defaultSchedule,
      defaultStart: "10:00",
      defaultEnd: "19:00",
      effectiveStart: "10:00",
      effectiveEnd: "19:00",
    });

    render(<WorkScheduleEditor schedule={defaultSchedule} onSaved={onSaved} />);

    expect(screen.queryByLabelText("上班")).toBeNull();
    expect(screen.queryByRole("button", { name: "保存" })).toBeNull();
    const hour = screen.getByRole("button", { name: "下班小时：18" });
    const minute = screen.getByRole("button", { name: "下班分钟：30" });
    expect(hour.tagName).toBe("BUTTON");
    expect(minute.tagName).toBe("BUTTON");
    expect(screen.queryByRole("combobox", { name: "下班小时" })).toBeNull();
    selectClockValue("下班小时", "19");

    await waitFor(() => {
      expect(saveDefaultWorkTimes).toHaveBeenCalledWith({
        startTime: "09:30",
        endTime: "19:30",
      });
    });
    expect(saveTodayWorkOverride).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalled();
  });

  it("saves today's override when the day already has one", async () => {
    const onSaved = vi.fn();
    vi.mocked(saveTodayWorkOverride).mockResolvedValue({
      ...defaultSchedule,
      hasTodayOverride: true,
      effectiveStart: "11:00",
      effectiveEnd: "20:00",
    });

    render(
      <WorkScheduleEditor
        schedule={{
          ...defaultSchedule,
          hasTodayOverride: true,
          effectiveStart: "11:00",
          effectiveEnd: "20:00",
        }}
        onSaved={onSaved}
      />,
    );

    expect(screen.getByText("今日临时")).toBeTruthy();
    selectClockValue("下班小时", "21");

    await waitFor(() => {
      expect(saveTodayWorkOverride).toHaveBeenCalledWith({
        startTime: "11:00",
        endTime: "21:00",
      });
    });
    expect(saveDefaultWorkTimes).not.toHaveBeenCalled();
  });

  it("restores the effective end time when an instant save fails", async () => {
    vi.mocked(saveDefaultWorkTimes).mockRejectedValue(new Error("保存失败"));

    render(<WorkScheduleEditor schedule={defaultSchedule} onSaved={vi.fn()} />);

    selectClockValue("下班小时", "19");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "下班小时：18" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "下班分钟：30" })).toBeTruthy();
    });
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("renders compact saved rows without subtitle or activation state", () => {
    const startEdit = vi.fn();
    const manager: WorkdayReminderManager = {
      reminders: [{
        id: "meeting-1",
        startTime: "10:00",
        endTime: "10:30",
        statusType: "meeting",
        createdAtMs: 1,
      }],
      activeReminder: null,
      nowMs: new Date(2026, 7, 19, 9, 0).getTime(),
      draft: null,
      storageError: null,
      startAdd: vi.fn(),
      startEdit,
      updateDraft: vi.fn(),
      saveDraft: vi.fn(),
      cancelDraft: vi.fn(),
      deleteDraftReminder: vi.fn(),
      clearAll: vi.fn(() => true),
    };

    render(
      <WorkScheduleEditor
        schedule={defaultSchedule}
        onSaved={vi.fn()}
        reminderManager={manager}
      />,
    );

    expect(screen.getByText("工位小闹钟")).toBeTruthy();
    expect(screen.queryByText("上班过程提醒")).toBeNull();
    expect(screen.queryByText(/已开启|已关闭|待设置/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /10:00–10:30.*会议中.*编辑/ }));
    expect(startEdit).toHaveBeenCalledWith("meeting-1");
  });

  it("shows one locked draft with explicit cancel and save actions", () => {
    const updateDraft = vi.fn();
    const saveDraft = vi.fn();
    const cancelDraft = vi.fn();
    const manager: WorkdayReminderManager = {
      reminders: [],
      activeReminder: null,
      nowMs: new Date(2026, 7, 19, 9, 0).getTime(),
      draft: {
        mode: "create",
        value: {
          id: "draft-1",
          startTime: "10:00",
          endTime: "10:30",
          statusType: null,
          createdAtMs: 1,
        },
        error: null,
      },
      storageError: null,
      startAdd: vi.fn(),
      startEdit: vi.fn(),
      updateDraft,
      saveDraft,
      cancelDraft,
      deleteDraftReminder: vi.fn(),
      clearAll: vi.fn(() => true),
    };

    render(
      <WorkScheduleEditor
        schedule={defaultSchedule}
        onSaved={vi.fn()}
        reminderManager={manager}
      />,
    );

    expect(screen.getByText("请先保存或取消当前修改")).toBeTruthy();
    expect(screen.getByRole("button", { name: "开始小时：10" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "开始分钟：00" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "结束小时：10" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "结束分钟：30" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "工作中" })).toBeNull();
    expect(screen.queryByRole("option", { name: "专注搬砖" })).toBeNull();
    expect(screen.queryByRole("option", { name: "准备下班" })).toBeNull();

    fireEvent.change(screen.getByRole("combobox", { name: "提醒内容" }), {
      target: { value: "meeting" },
    });
    expect(updateDraft).toHaveBeenCalledWith({ statusType: "meeting" });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(saveDraft).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(cancelDraft).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "＋ 添加" }).hasAttribute("disabled")).toBe(true);
  });

  it("requires a second click before clearing all reminders", () => {
    const clearAll = vi.fn(() => true);
    const manager: WorkdayReminderManager = {
      reminders: [{
        id: "meeting-1",
        startTime: "10:00",
        endTime: "10:30",
        statusType: "meeting",
        createdAtMs: 1,
      }],
      activeReminder: null,
      nowMs: 1,
      draft: null,
      storageError: null,
      startAdd: vi.fn(),
      startEdit: vi.fn(),
      updateDraft: vi.fn(),
      saveDraft: vi.fn(),
      cancelDraft: vi.fn(),
      deleteDraftReminder: vi.fn(),
      clearAll,
    };
    render(
      <WorkScheduleEditor
        schedule={defaultSchedule}
        onSaved={vi.fn()}
        reminderManager={manager}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "清空全部" }));
    expect(clearAll).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "确认清空" }));
    expect(clearAll).toHaveBeenCalledTimes(1);
  });
});
