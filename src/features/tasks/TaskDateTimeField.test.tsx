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

  it("exposes separate date and minute controls", () => {
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
    const time = screen.getByLabelText("开始时间 时分");
    expect(date.getAttribute("type")).toBe("date");
    expect(date.getAttribute("min")).toBe("2026-08-26");
    expect(time.getAttribute("type")).toBe("time");
    expect(time.getAttribute("min")).toBe("09:18");
    expect(time.getAttribute("step")).toBe("60");

    fireEvent.change(date, { target: { value: "2026-08-27" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-08-27T09:18");
    fireEvent.change(time, { target: { value: "10:25" } });
    expect(onChange).toHaveBeenLastCalledWith("2026-08-26T10:25");
  });
});
