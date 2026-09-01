import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppUpdateAvatar } from "./AppUpdateAvatar";

afterEach(cleanup);

describe("AppUpdateAvatar", () => {
  it("keeps the resting avatar available as a manual update check", () => {
    render(
      <AppUpdateAvatar
        state={{ status: "current" }}
        onActivate={() => undefined}
      />,
    );

    expect(screen.getByRole("button", { name: "检查应用更新" })).toBeTruthy();
    expect(screen.queryByText("↓")).toBeNull();
  });

  it("shows the download badge and starts an available update", () => {
    const onActivate = vi.fn();
    render(
      <AppUpdateAvatar
        state={{ status: "available", version: "0.1.2", body: "Fixes" }}
        onActivate={onActivate}
      />,
    );

    const button = screen.getByRole("button", {
      name: "发现新版本 0.1.2，点击下载更新",
    });
    expect(screen.getByText("↓")).toBeTruthy();

    fireEvent.click(button);

    expect(onActivate).toHaveBeenCalledTimes(1);
    expect(screen.getByText("发现新版本 0.1.2")).toBeTruthy();
  });

  it("reports download progress and disables duplicate activation", () => {
    render(
      <AppUpdateAvatar
        state={{ status: "downloading", version: "0.1.2", progress: 50 }}
        onActivate={() => undefined}
      />,
    );

    const button = screen.getByRole("button", {
      name: "正在下载版本 0.1.2",
    });
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("50%")).toBeTruthy();
  });

  it("shows a visible retry message after failure", () => {
    const onActivate = vi.fn();
    render(
      <AppUpdateAvatar
        state={{
          status: "failed",
          message: "更新安装失败，点击重试",
          retry: "install",
        }}
        onActivate={onActivate}
      />,
    );

    const button = screen.getByRole("button", {
      name: "更新安装失败，点击重试",
    });
    expect(screen.getByRole("alert").textContent).toBe(
      "更新安装失败，点击重试",
    );
    expect(screen.getByText("!")).toBeTruthy();

    fireEvent.click(button);
    expect(onActivate).toHaveBeenCalledTimes(1);
  });
});
