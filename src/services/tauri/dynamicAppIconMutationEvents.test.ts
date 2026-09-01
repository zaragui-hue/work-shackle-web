import { invoke } from "@tauri-apps/api/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  DYNAMIC_APP_ICON_REFRESH_EVENT,
} from "./dynamicAppIconEvents";
import { startOvertime } from "./overtime";
import { saveDefaultWorkTimes } from "./settings";
import { createTask, queryTasks } from "./tasks";
import { switchWorkStatus } from "./workStatus";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const changed = vi.fn();

describe("dynamic app icon mutation events", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    changed.mockReset();
    window.addEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, changed);
  });

  afterEach(() => {
    window.removeEventListener(DYNAMIC_APP_ICON_REFRESH_EVENT, changed);
  });

  it("dispatches once after each successful relevant mutation", async () => {
    vi.mocked(invoke).mockResolvedValue({});

    await createTask({
      title: "提交方案",
      plannedAtMs: 1,
      deadlineAtMs: 2,
    });
    await saveDefaultWorkTimes({ startTime: "09:00", endTime: "18:00" });
    await startOvertime();
    await switchWorkStatus("meeting");

    expect(changed).toHaveBeenCalledTimes(4);
  });

  it("does not dispatch for reads or rejected mutations", async () => {
    vi.mocked(invoke).mockResolvedValueOnce([]);
    await queryTasks();

    vi.mocked(invoke).mockRejectedValueOnce(new Error("failed"));
    await expect(startOvertime()).rejects.toThrow("failed");

    expect(changed).not.toHaveBeenCalled();
  });
});
