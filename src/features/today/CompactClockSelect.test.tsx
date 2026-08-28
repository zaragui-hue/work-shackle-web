import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CompactClockSelect } from "./CompactClockSelect";

const VALUES = ["17", "18", "19", "20"];

afterEach(cleanup);

describe("CompactClockSelect", () => {
  it("opens a bounded listbox and selects a value", () => {
    const onSelect = vi.fn();
    render(
      <CompactClockSelect
        label="下班小时"
        value="18"
        values={VALUES}
        onSelect={onSelect}
      />,
    );

    const trigger = screen.getByRole("button", { name: "下班小时：18" });
    expect(trigger.getAttribute("aria-expanded")).toBe("false");

    fireEvent.click(trigger);
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("listbox", { name: "下班小时选项" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "18" }).getAttribute("aria-selected"))
      .toBe("true");

    fireEvent.click(screen.getByRole("option", { name: "19" }));
    expect(onSelect).toHaveBeenCalledWith("19");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("supports arrow navigation, confirmation, and escape", () => {
    const onSelect = vi.fn();
    render(
      <CompactClockSelect
        label="下班小时"
        value="18"
        values={VALUES}
        onSelect={onSelect}
      />,
    );

    const trigger = screen.getByRole("button", { name: "下班小时：18" });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    expect(trigger.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("option", { name: "19" }).className)
      .toContain("compact-clock-select__option--active");

    fireEvent.keyDown(trigger, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledWith("19");
    expect(screen.queryByRole("listbox")).toBeNull();

    fireEvent.click(trigger);
    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("closes on outside input or value refresh and disables interaction while saving", () => {
    const { rerender } = render(
      <CompactClockSelect
        label="下班小时"
        value="18"
        values={VALUES}
        onSelect={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "下班小时：18" }));
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole("listbox")).toBeNull();

    rerender(
      <CompactClockSelect
        label="下班小时"
        value="19"
        values={VALUES}
        onSelect={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "下班小时：19" }));
    rerender(
      <CompactClockSelect
        label="下班小时"
        value="20"
        values={VALUES}
        onSelect={vi.fn()}
      />,
    );
    expect(screen.queryByRole("listbox")).toBeNull();

    rerender(
      <CompactClockSelect
        label="下班小时"
        value="20"
        values={VALUES}
        disabled
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "下班小时：20" }))
      .toHaveProperty("disabled", true);
  });
});
