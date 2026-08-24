import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createTask } from "../../services/tauri/tasks";
import { CreateTaskDrawer } from "./CreateTaskDrawer";

vi.mock("../../services/tauri/tasks", () => ({
  createTask: vi.fn(),
  mapTaskError: () => "创建失败",
}));

vi.mock("./ContactPicker", () => ({
  ContactPicker: () => <div data-testid="contact-picker" />,
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("CreateTaskDrawer", () => {
  it("renders the create form in a right-side drawer", () => {
    render(<CreateTaskDrawer open onClose={vi.fn()} />);

    expect(screen.getByRole("dialog", { name: "新建任务" })).toBeTruthy();
    expect(document.querySelector(".ws-drawer__panel")).toBeTruthy();
    expect(document.querySelector(".ws-modal__panel")).toBeNull();
  });

  it("closes from the drawer footer", () => {
    const onClose = vi.fn();
    render(<CreateTaskDrawer open onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "取消" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("notifies the page and closes after a successful creation", async () => {
    const created = {
      id: "task-1",
      title: "抽屉新任务",
      plannedAtMs: Date.now(),
      priority: 2,
      status: "not_started" as const,
      createdAtMs: Date.now(),
      updatedAtMs: Date.now(),
    };
    vi.mocked(createTask).mockResolvedValue(created);
    const onCreated = vi.fn();
    const onClose = vi.fn();
    render(
      <CreateTaskDrawer open onClose={onClose} onCreated={onCreated} />,
    );

    fireEvent.change(screen.getByLabelText("任务名称"), {
      target: { value: "抽屉新任务" },
    });
    fireEvent.click(screen.getByRole("button", { name: "创建任务" }));

    await waitFor(() => expect(createTask).toHaveBeenCalledTimes(1));
    expect(onCreated).toHaveBeenCalledWith(created);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
