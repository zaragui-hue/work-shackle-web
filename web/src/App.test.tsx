import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App startup", () => {
  it("explains the supported browser requirement", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "当前浏览器不支持本地文件夹" })).toBeVisible();
    expect(screen.queryByText("任务现场")).not.toBeInTheDocument();
    expect(screen.queryByText("生存设置")).not.toBeInTheDocument();
  });
});
