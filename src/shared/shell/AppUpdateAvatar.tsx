import { useState } from "react";

import type { AppUpdateState } from "./useAppUpdate";
import "./AppUpdateAvatar.css";

type AppUpdateAvatarProps = {
  state: AppUpdateState;
  onActivate(): void | Promise<void>;
};

export function AppUpdateAvatar({
  state,
  onActivate,
}: AppUpdateAvatarProps) {
  const [expanded, setExpanded] = useState(false);
  const busy =
    state.status === "checking" ||
    state.status === "downloading" ||
    state.status === "installing";
  const showBubble = expanded || state.status === "failed";

  const activate = () => {
    setExpanded(true);
    void onActivate();
  };

  return (
    <div className="ws-update-avatar" data-state={state.status}>
      <button
        type="button"
        className="ws-shell__logo ws-update-avatar__button"
        aria-label={labelForState(state)}
        aria-busy={busy}
        disabled={busy}
        onClick={activate}
      >
        <span aria-hidden="true">WS</span>
        {badgeForState(state)}
      </button>
      {showBubble ? (
        <p
          className="ws-update-avatar__bubble"
          role={state.status === "failed" ? "alert" : "status"}
        >
          {copyForState(state)}
        </p>
      ) : null}
    </div>
  );
}

function labelForState(state: AppUpdateState) {
  switch (state.status) {
    case "checking":
      return "正在检查应用更新";
    case "available":
      return `发现新版本 ${state.version}，点击下载更新`;
    case "downloading":
      return `正在下载版本 ${state.version}`;
    case "installing":
      return `正在安装版本 ${state.version}`;
    case "failed":
      return state.message;
    default:
      return "检查应用更新";
  }
}

function badgeForState(state: AppUpdateState) {
  if (state.status === "available") {
    return <span className="ws-update-avatar__badge">↓</span>;
  }

  if (state.status === "downloading") {
    return (
      <span className="ws-update-avatar__badge">
        {state.progress === null ? "…" : `${state.progress}%`}
      </span>
    );
  }

  if (state.status === "installing") {
    return <span className="ws-update-avatar__badge">↻</span>;
  }

  if (state.status === "failed") {
    return <span className="ws-update-avatar__badge">!</span>;
  }

  return null;
}

function copyForState(state: AppUpdateState) {
  switch (state.status) {
    case "checking":
      return "正在检查更新";
    case "current":
      return "已是最新版本";
    case "available":
      return `发现新版本 ${state.version}`;
    case "downloading":
      return state.progress === null
        ? "正在下载更新"
        : `更新已下载 ${state.progress}%`;
    case "installing":
      return "正在安装，完成后将重新启动";
    case "failed":
      return state.message;
  }
}
