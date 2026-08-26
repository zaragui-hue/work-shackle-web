import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { computeDdlProgress } from "../../services/tauri/ddl";
import { DdlTimeProgress } from "./DdlTimeProgress";

vi.mock("../../services/tauri/ddl", () => ({
  computeDdlProgress: vi.fn(),
}));

describe("DdlTimeProgress", () => {
  beforeEach(() => {
    vi.mocked(computeDdlProgress).mockResolvedValue({
      progressRatio: 0.62,
      remainingMs: 3_800,
      isOverdue: false,
      emotion: "notice",
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders nothing when the task has no deadline", () => {
    const { container } = render(<DdlTimeProgress plannedAtMs={1_000} />);

    expect(computeDdlProgress).not.toHaveBeenCalled();
    expect(container.firstChild).toBeNull();
  });

  it("shows elapsed-time copy from Rust progress, not task completion", async () => {
    render(
      <DdlTimeProgress plannedAtMs={1_000} deadlineAtMs={2_000} />,
    );

    expect(await screen.findByText("时间已走过 62%")).toBeTruthy();
    expect(screen.getByText("注意")).toBeTruthy();
    expect(screen.queryByText(/任务完成|任务进度/)).toBeNull();
    expect(screen.getByRole("progressbar", { name: "时间进度" })).toBeTruthy();
    expect(
      document
        .querySelector("img[data-mascot-state]")
        ?.getAttribute("data-mascot-state"),
    ).toBe("ddl-calm");
    expect(
      document
        .querySelector("img[data-mascot-animation]")
        ?.getAttribute("data-mascot-animation"),
    ).toBe("breathe");
  });

  it("shows only the live remaining text in compact presentation", async () => {
    render(
      <DdlTimeProgress
        plannedAtMs={Date.now() - 1_000}
        deadlineAtMs={Date.now() + 60_000}
        presentation="remaining-only"
      />,
    );

    expect(await screen.findByTestId("ddl-remaining-inline")).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "时间进度" })).toBeNull();
    expect(document.querySelector("img[data-mascot-state]")).toBeNull();
  });
});
