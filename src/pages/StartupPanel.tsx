import type { StartupViewState } from "../services/tauri/startup";
import { Button } from "../shared/ui";
import "./StartupPanel.css";

type StartupPanelProps = {
  viewState: StartupViewState;
  message: string;
  workspacePath: string | null;
  recoveryError?: string | null;
  recovering?: boolean;
  onRecoverWorkspace?: () => void;
};

export function StartupPanel({
  viewState,
  message,
  workspacePath,
  recoveryError,
  recovering = false,
  onRecoverWorkspace,
}: StartupPanelProps) {
  const showRecovery =
    viewState === "workspaceNotFound" && onRecoverWorkspace !== undefined;

  return (
    <main className="ws-startup">
      <section className="ws-startup__panel">
        <p className="ws-startup__eyebrow">精神状态事务所</p>
        <h1>正在把桌子擦干净</h1>
        <p className={`ws-startup__status ws-startup__status--${viewState}`}>
          {message}
        </p>
        {workspacePath ? (
          <p className="ws-startup__path">{workspacePath}</p>
        ) : null}
        {showRecovery ? (
          <div className="ws-startup__recovery">
            <p className="ws-startup__recovery-copy">
              之前设置的工作目录找不到了，可能被移动或删除。请选择新的工作目录继续。
            </p>
            {recoveryError ? (
              <p className="ws-startup__recovery-error" role="alert">
                {recoveryError}
              </p>
            ) : null}
            <Button
              onClick={onRecoverWorkspace}
              disabled={recovering}
            >
              {recovering ? "切换中…" : "选择新的工作目录"}
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
