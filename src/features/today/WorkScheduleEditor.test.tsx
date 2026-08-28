import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  saveDefaultWorkTimes,
  saveTodayWorkOverride,
} from "../../services/tauri/settings";
import { WorkScheduleEditor } from "./WorkScheduleEditor";

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
});
