import { useEffect, useState } from "react";
import {
  initializeApp,
  mapStartupError,
  type AppError,
  type StartupViewState,
} from "./services/tauri/startup";
import { AppShell } from "./shared/shell/AppShell";
import { StartupPanel } from "./pages/StartupPanel";

function App() {
  const [viewState, setViewState] = useState<StartupViewState>("preparing");
  const [message, setMessage] = useState("正在准备工作目录");
  const [workspacePath, setWorkspacePath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setViewState("preparing");
      setMessage("正在准备工作目录");

      try {
        const ready = await initializeApp();
        if (cancelled) {
          return;
        }
        setWorkspacePath(ready.workspacePath);
        setViewState("ready");
        setMessage("工作目录已准备完成");
      } catch (error) {
        if (cancelled) {
          return;
        }
        const mapped = mapStartupError(error as AppError);
        setViewState(mapped.state);
        setMessage(mapped.message);
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  if (viewState === "ready") {
    return <AppShell />;
  }

  return (
    <StartupPanel
      viewState={viewState}
      message={message}
      workspacePath={workspacePath}
    />
  );
}

export default App;
