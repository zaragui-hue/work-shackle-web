import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TaskPriorityMenu } from "./TaskPriorityMenu";

afterEach(cleanup);

describe("TaskPriorityMenu", () => {
  it("opens all five priority choices and selects a new value", () => {
    const onChange = vi.fn();
    render(
      <TaskPriorityMenu
        taskTitle="季度复盘"
        value={3}
        onChange={onChange}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: "季度复盘 紧急程度：😵 有点急",
      }),
    );

    expect(screen.getAllByRole("menuitemradio")).toHaveLength(5);
    fireEvent.click(
      screen.getByRole("menuitemradio", { name: "🚨 现在立刻马上要" }),
    );

    expect(onChange).toHaveBeenCalledWith(5);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("does not emit when the current priority is chosen", () => {
    const onChange = vi.fn();
    render(
      <TaskPriorityMenu
        taskTitle="季度复盘"
        value={3}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /季度复盘 紧急程度/ }));
    fireEvent.click(screen.getByRole("menuitemradio", { name: "😵 有点急" }));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("supports keyboard navigation and escape dismissal", () => {
    render(
      <TaskPriorityMenu
        taskTitle="季度复盘"
        value={2}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /季度复盘 紧急程度/ });
    fireEvent.keyDown(trigger, { key: "ArrowDown" });

    const choices = screen.getAllByRole("menuitemradio");
    expect(document.activeElement).toBe(choices[0]);

    fireEvent.keyDown(choices[0], { key: "ArrowDown" });
    expect(document.activeElement).toBe(choices[1]);

    fireEvent.keyDown(choices[1], { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("closes from the trigger with escape after a pointer open", () => {
    render(
      <TaskPriorityMenu
        taskTitle="季度复盘"
        value={2}
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /季度复盘 紧急程度/ });
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeTruthy();

    fireEvent.keyDown(trigger, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("cannot open while disabled", () => {
    render(
      <TaskPriorityMenu
        taskTitle="季度复盘"
        value={3}
        disabled
        onChange={vi.fn()}
      />,
    );

    const trigger = screen.getByRole("button", { name: /季度复盘 紧急程度/ });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole("menu")).toBeNull();
  });
});
