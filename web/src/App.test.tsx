import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import App from "./App";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
});

describe("App startup", () => {
  it("explains the supported browser requirement", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "当前浏览器不支持本地文件夹" })).toBeVisible();
    expect(screen.queryByText("任务现场")).not.toBeInTheDocument();
    expect(screen.queryByText("生存设置")).not.toBeInTheDocument();
  });

  it("renders the App-aligned today workspace in preview mode", async () => {
    window.history.replaceState({}, "", "/?preview=today");
    render(<App />);
    expect(screen.getByText("精神状态事务所")).toBeVisible();
    expect(screen.getByRole("button", { name: "今日状态" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: /新建任务/ })).toBeVisible();
    expect(screen.getByText("工位使用证")).toBeVisible();
    expect(await screen.findByText("已保存到本地文件夹")).toBeVisible();
  });
});
