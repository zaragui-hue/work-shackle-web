import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppNavigation } from "./AppNavigation";

afterEach(cleanup);

describe("AppNavigation", () => {
  it("exposes all pages with full accessible names", () => {
    render(<AppNavigation currentTab="today" onChange={() => undefined} />);

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "今日状态" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "任务现场" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "生存设置" })).toBeTruthy();
  });

  it("marks the current page", () => {
    render(<AppNavigation currentTab="tasks" onChange={() => undefined} />);

    expect(
      screen.getByRole("button", { name: "任务现场" }).getAttribute("aria-current"),
    ).toBe("page");
    expect(
      screen.getByRole("button", { name: "今日状态" }).getAttribute("aria-current"),
    ).toBeNull();
  });

  it("switches pages in one click", () => {
    const onChange = vi.fn();
    render(<AppNavigation currentTab="today" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "生存设置" }));

    expect(onChange).toHaveBeenCalledWith("settings");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
