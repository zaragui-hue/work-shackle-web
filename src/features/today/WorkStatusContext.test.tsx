import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getCurrentWorkStatus,
  listWorkStatuses,
  switchWorkStatus,
} from "../../services/tauri/workStatus";
import { WorkStatusProvider, useWorkStatus } from "./WorkStatusContext";

vi.mock("../../services/tauri/workStatus", async () => {
  const actual = await vi.importActual<typeof import("../../services/tauri/workStatus")>(
    "../../services/tauri/workStatus",
  );
  return {
    ...actual,
    listWorkStatuses: vi.fn(),
    getCurrentWorkStatus: vi.fn(),
    switchWorkStatus: vi.fn(),
  };
});

const working = {
  recordId: "r1",
  statusType: "working",
  emoji: "🧱",
  name: "工作中",
  displayCopy: "班味加载中。",
  workDate: "2026-08-24",
  startAtMs: 1,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

function Probe() {
  const { current, error, switchStatus } = useWorkStatus();
  return (
    <div>
      <span>{current?.name ?? "读取中"}</span>
      {error ? <span role="alert">{error}</span> : null}
      <button type="button" onClick={() => void switchStatus("meeting").catch(() => undefined)}>
        切会议
      </button>
    </div>
  );
}

describe("WorkStatusProvider", () => {
  it("loads and updates the canonical status", async () => {
    vi.mocked(listWorkStatuses).mockResolvedValue([]);
    vi.mocked(getCurrentWorkStatus).mockResolvedValue(working);
    vi.mocked(switchWorkStatus).mockResolvedValue({
      ...working,
      recordId: "r2",
      statusType: "meeting",
      emoji: "💻",
      name: "会议中",
    });

    render(<WorkStatusProvider><Probe /></WorkStatusProvider>);
    expect(await screen.findByText("工作中")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "切会议" }));
    expect(await screen.findByText("会议中")).toBeTruthy();
  });

  it("keeps the previous status when switching fails", async () => {
    vi.mocked(listWorkStatuses).mockResolvedValue([]);
    vi.mocked(getCurrentWorkStatus).mockResolvedValue(working);
    vi.mocked(switchWorkStatus).mockRejectedValue({ code: "DATABASE_ERROR", details: {} });

    render(<WorkStatusProvider><Probe /></WorkStatusProvider>);
    expect(await screen.findByText("工作中")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "切会议" }));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("数据库"));
    expect(screen.getByText("工作中")).toBeTruthy();
  });
});
