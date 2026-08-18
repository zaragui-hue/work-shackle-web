import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";
import {
  initializeApp,
  mapStartupError,
  type AppError,
  type StartupViewState,
} from "./services/tauri/startup";
import {
  mapWorkspaceError,
  setWorkspacePath as switchWorkspacePath,
  type WorkspaceAppError,
} from "./services/tauri/workspace";
import { AppShell } from "./shared/shell/AppShell";
import { StartupPanel } from "./pages/StartupPanel";

function App() {
  const [viewState, setViewState] = useState<StartupViewState>("preparing");
  const [message, setMessage] = useState("正在准备工作目录");
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState(false);

  const boot = useCallback(async () => {
    setViewState("preparing");
    setMessage("正在准备工作目录");
    setRecoveryError(null);

    try {
      const ready = await initializeApp();
      setWorkspacePath(ready.workspacePath);
      setViewState("ready");
      setMessage("工作目录已准备完成");
    } catch (error) {
      const mapped = mapStartupError(error as AppError);
      setViewState(mapped.state);
      setMessage(mapped.message);
      if (mapped.state === "workspaceNotFound") {
        const details = (error as AppError & { details?: { path?: string } }).details;
        setWorkspacePath(details?.path ?? null);
      }
    }
  }, []);

  useEffect(() => {
    void boot();
  }, [boot]);

  const onRecoverWorkspace = async () => {
    if (recovering) {
      return;
    }

    setRecoveryError(null);
    const selected = await open({
      directory: true,
      multiple: false,
      title: "选择新的工作目录",
    });
    if (selected === null) {
      return;
    }

    const path = Array.isArray(selected) ? selected[0] : selected;
    if (!path) {
      return;
    }

    setRecovering(true);
    try {
      const status = await switchWorkspacePath(path);
      setWorkspacePath(status.resolvedPath);
      await boot();
    } catch (error) {
      setRecoveryError(mapWorkspaceError(error as WorkspaceAppError));
    } finally {
      setRecovering(false);
    }
  };

  if (viewState === "ready") {
    return <AppShell />;
  }

  return (
    <StartupPanel
      viewState={viewState}
      message={message}
      workspacePath={workspacePath}
      recoveryError={recoveryError}
      recovering={recovering}
      onRecoverWorkspace={
        viewState === "workspaceNotFound" ? () => void onRecoverWorkspace() : undefined
      }
    />
  );
}

export default App;
