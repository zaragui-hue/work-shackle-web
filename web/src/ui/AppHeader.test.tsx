import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppHeader } from "./AppHeader";

describe("AppHeader", () => {
  it("keeps today active and reports unavailable Web tabs", async () => {
    const user = userEvent.setup();
    const onUnavailable = vi.fn();
    render(<AppHeader statusName="工作中" statusEmoji="🧱" onUnavailable={onUnavailable} />);
    expect(screen.getByRole("button", { name: "今日状态" })).toHaveAttribute("aria-current", "page");
    await user.click(screen.getByRole("button", { name: "任务现场" }));
    await user.click(screen.getByRole("button", { name: "生存设置" }));
    expect(onUnavailable).toHaveBeenNthCalledWith(1, "任务");
    expect(onUnavailable).toHaveBeenNthCalledWith(2, "设置");
  });
});
