import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { createDefaultData } from "../../domain/defaultData";
import { WebTaskDrawer } from "./WebTaskDrawer";

describe("WebTaskDrawer", () => {
  it("creates a task from the right-side drawer", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(<WebTaskDrawer mode="create" data={createDefaultData()} onClose={vi.fn()} onSave={onSave} />);
    await user.type(screen.getByLabelText("任务名称"), "准备周会");
    await user.click(screen.getByRole("button", { name: "保存任务" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "准备周会" }));
  });
});
