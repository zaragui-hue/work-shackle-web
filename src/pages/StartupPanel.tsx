import type { StartupViewState } from "../services/tauri/startup";
import "./StartupPanel.css";

type StartupPanelProps = {
  viewState: StartupViewState;
  message: string;
  workspacePath: string | null;
};

export function StartupPanel({
  viewState,
  message,
  workspacePath,
}: StartupPanelProps) {
  return (
    <main className="ws-startup">
      <section className="ws-startup__panel">
        <p className="ws-startup__eyebrow">Work Shackle</p>
        <h1>正在把桌子擦干净</h1>
        <p className={`ws-startup__status ws-startup__status--${viewState}`}>
          {message}
        </p>
        {workspacePath ? (
          <p className="ws-startup__path">{workspacePath}</p>
        ) : null}
      </section>
    </main>
  );
}
