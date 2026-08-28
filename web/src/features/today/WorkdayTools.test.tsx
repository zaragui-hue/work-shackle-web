import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createDefaultData } from "../../domain/defaultData";
import { WorkdayTools } from "./WorkdayTools";

const props = { data: createDefaultData(), endTime: "18:00", onChangeEnd: vi.fn(), onRemindersChange: vi.fn(), onBackup: vi.fn(), onRetrySave: vi.fn() };

describe("WorkdayTools", () => {
  it("shows Web persistence state in the right column", () => {
    render(<WorkdayTools {...props} saveState="saved" saveError="" />);
    expect(screen.getByText("已保存到本地文件夹")).toBeVisible();
    expect(screen.getByRole("button", { name: "立即备份" })).toBeVisible();
  });

  it("offers retry when data is unsaved", () => {
    render(<WorkdayTools {...props} saveState="unsaved" saveError="写入失败" />);
    expect(screen.getByText("写入失败")).toBeVisible();
    expect(screen.getByRole("button", { name: "重试保存" })).toBeVisible();
  });
});
