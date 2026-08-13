import { useEffect, useState } from "react";
import "./App.css";
import {
  initializeApp,
  mapStartupError,
  type AppError,
  type StartupViewState,
} from "./services/tauri/startup";

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

  return (
    <main className="app">
      <div className="startup-panel">
        <h1>Work Shackle</h1>
        <p className={`startup-status startup-status--${viewState}`}>{message}</p>
        {workspacePath ? (
          <p className="startup-path">{workspacePath}</p>
        ) : null}
      </div>
    </main>
  );
}

export default App;
