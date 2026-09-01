import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  listStatusCopies,
  listWorkStatuses,
} from "../../services/tauri/workStatus";
import { StatusCopySection } from "./StatusCopySection";

vi.mock("../../services/tauri/workStatus", async () => {
  const actual = await vi.importActual<typeof import("../../services/tauri/workStatus")>(
    "../../services/tauri/workStatus",
  );
  return {
    ...actual,
    listWorkStatuses: vi.fn(),
    listStatusCopies: vi.fn(),
    saveStatusCopy: vi.fn(),
  };
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StatusCopySection", () => {
  it("hides working while retaining focus and prepare-to-leave copy settings", async () => {
    vi.mocked(listWorkStatuses).mockResolvedValue([
      { id: "working", emoji: "🧱", name: "工作中", sortOrder: 1, selectable: true },
      { id: "focus_brick", emoji: "🎧", name: "专注搬砖", sortOrder: 2, selectable: true },
      { id: "preparing_leave", emoji: "👜", name: "准备下班", sortOrder: 12, selectable: true },
    ]);
    vi.mocked(listStatusCopies).mockResolvedValue([]);

    render(<StatusCopySection />);

    expect(await screen.findByText("专注搬砖")).toBeTruthy();
    expect(screen.getByText("准备下班")).toBeTruthy();
    expect(screen.queryByText("工作中")).toBeNull();
    await waitFor(() => {
      expect(listStatusCopies).toHaveBeenCalledWith("focus_brick");
      expect(listStatusCopies).toHaveBeenCalledWith("preparing_leave");
    });
    expect(listStatusCopies).not.toHaveBeenCalledWith("working");
  });
});
