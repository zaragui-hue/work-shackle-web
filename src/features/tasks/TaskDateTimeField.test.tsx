import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskDateTimeField } from "./TaskDateTimeField";
import {
  addMinutesToDateTime,
  currentMinuteValue,
  isBeforeCurrentMinute,
} from "./taskDateTime";

afterEach(cleanup);

describe("task date and time fields", () => {
  it("rounds seconds up to the next selectable minute", () => {
    expect(currentMinuteValue(new Date(2026, 7, 26, 9, 17, 43)))
      .toBe("2026-08-26T09:18");
    expect(currentMinuteValue(new Date(2026, 7, 26, 9, 17, 0)))
      .toBe("2026-08-26T09:17");
  });

  it("compares and increments local minute values", () => {
    const now = new Date(2026, 7, 26, 9, 17, 43);
    expect(isBeforeCurrentMinute("2026-08-26T09:17", now)).toBe(true);
    expect(isBeforeCurrentMinute("2026-08-26T09:18", now)).toBe(false);
    expect(addMinutesToDateTime("2026-08-26T23:59", 1)).toBe("2026-08-27T00:00");
  });

  it("exposes separate date, hour, and minute selectors", () => {
    const onChange = vi.fn();
    render(
      <TaskDateTimeField
        label="开始时间"
        value="2026-08-26T09:18"
        min="2026-08-26T09:18"
        onChange={onChange}
      />,
    );

    const date = screen.getByLabelText("开始时间 日期");
    const hour = screen.getByLabelText("开始时间 小时");
    const minute = screen.getByLabelText("开始时间 分钟");
    expect(date.getAttribute("type")).toBe("date");
    expect(date.getAttribute("min")).toBe("2026-08-26");
    expect(hour.tagName).toBe("SELECT");
    expect(minute.tagName).toBe("SELECT");
    expect((hour as HTMLSelectElement).options).toHaveLength(25);
    expect((minute as HTMLSelectElement).options).toHaveLength(61);
    expect((hour as HTMLSelectElement).querySelector('option[value="08"]')?.disabled).toBe(true);
    expect((minute as HTMLSelectElement).querySelector('option[value="17"]')?.disabled).toBe(true);
    expect((minute as HTMLSelectElement).querySelector('option[value="18"]')?.disabled).toBe(false);

    fireEvent.change(date, { target: { value: "2026-08-27" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-08-27T09:18");
    fireEvent.change(hour, { target: { value: "10" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-08-26T10:18");
    fireEvent.change(minute, { target: { value: "25" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-08-26T09:25");
  });

  it("clamps a newly selected minimum date to its earliest valid minute", () => {
    const onChange = vi.fn();
    render(
      <TaskDateTimeField
        label="开始时间"
        value="2026-08-27T08:00"
        min="2026-08-26T09:18"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("开始时间 日期"), {
      target: { value: "2026-08-26" },
    });

    expect(onChange).toHaveBeenCalledWith("2026-08-26T09:18");
  });
});
