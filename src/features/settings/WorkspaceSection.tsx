import { open } from "@tauri-apps/plugin-dialog";
import { useCallback, useEffect, useState } from "react";

import {
  getWorkspaceStatus,
  mapWorkspaceError,
  setWorkspacePath,
  type WorkspaceAppError,
  type WorkspaceStatus,
} from "../../services/tauri/workspace";
import { Button } from "../../shared/ui";

type WorkspaceSectionProps = {
  onSwitched?: (status: WorkspaceStatus) => void;
};

export function WorkspaceSection({ onSwitched }: WorkspaceSectionProps) {
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const refreshStatus = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const next = await getWorkspaceStatus();
      setStatus(next);
    } catch (error) {
      setLoadError(mapWorkspaceError(error as WorkspaceAppError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const onChooseDirectory = async () => {
    if (switching) {
      return;
    }

    setActionError(null);
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

    setSwitching(true);
    try {
      const next = await setWorkspacePath(path);
      setStatus(next);
      onSwitched?.(next);
    } catch (error) {
      setActionError(mapWorkspaceError(error as WorkspaceAppError));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <section className="settings-section">
      <h3 className="settings-section__title">工作目录</h3>
      <p className="settings-section__hint">
        切换工作目录不会移动或复制现有数据。每个目录各自保存任务与设置。
      </p>

      {loading ? <p className="settings-section__hint">加载中…</p> : null}
      {loadError ? (
        <p className="settings-section__error" role="alert">
          {loadError}
        </p>
      ) : null}

      {!loading && !loadError && status ? (
        <>
          <p className="settings-workspace__path">{status.resolvedPath}</p>
          {actionError ? (
            <p className="settings-section__error" role="alert">
              {actionError}
            </p>
          ) : null}
          <div className="settings-work-time__actions">
            <Button
              variant="secondary"
              onClick={() => void onChooseDirectory()}
              disabled={switching}
            >
              {switching ? "切换中…" : "选择新的工作目录"}
            </Button>
          </div>
        </>
      ) : null}
    </section>
  );
}
