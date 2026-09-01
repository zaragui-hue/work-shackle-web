import { useCallback, useEffect, useRef, useState } from "react";

import {
  appUpdateClient,
  type AppUpdateCandidate,
  type AppUpdateClient,
} from "../../services/tauri/appUpdate";

export type AppUpdateState =
  | { status: "checking" }
  | { status: "current" }
  | { status: "available"; version: string; body: string | null }
  | { status: "downloading"; version: string; progress: number | null }
  | { status: "installing"; version: string }
  | { status: "failed"; message: string; retry: "check" | "install" };

export function useAppUpdate(client: AppUpdateClient = appUpdateClient): {
  state: AppUpdateState;
  activate(): Promise<void>;
} {
  const [state, setState] = useState<AppUpdateState>({ status: "checking" });
  const candidateRef = useRef<AppUpdateCandidate | null>(null);
  const activeRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const updateState = useCallback((next: AppUpdateState) => {
    if (mountedRef.current) {
      setState(next);
    }
  }, []);

  const checkForUpdate = useCallback(async () => {
    if (activeRef.current) {
      return;
    }

    activeRef.current = true;
    updateState({ status: "checking" });
    try {
      const candidate = await client.check();
      candidateRef.current = candidate;
      updateState(
        candidate
          ? {
              status: "available",
              version: candidate.version,
              body: candidate.body,
            }
          : { status: "current" },
      );
    } catch {
      candidateRef.current = null;
      updateState({
        status: "failed",
        message: "检查更新失败，点击重试",
        retry: "check",
      });
    } finally {
      activeRef.current = false;
    }
  }, [client, updateState]);

  const installCandidate = useCallback(async () => {
    const candidate = candidateRef.current;
    if (!candidate || activeRef.current) {
      return;
    }

    activeRef.current = true;
    updateState({
      status: "downloading",
      version: candidate.version,
      progress: 0,
    });
    try {
      await candidate.downloadAndInstall((event) => {
        if (event.phase === "installing") {
          updateState({ status: "installing", version: candidate.version });
          return;
        }

        const progress = event.total
          ? Math.min(
              100,
              Math.round((event.downloaded / event.total) * 100),
            )
          : null;
        updateState({
          status: "downloading",
          version: candidate.version,
          progress,
        });
      });
      await client.relaunch();
    } catch {
      updateState({
        status: "failed",
        message: "更新安装失败，点击重试",
        retry: "install",
      });
    } finally {
      activeRef.current = false;
    }
  }, [client, updateState]);

  useEffect(() => {
    void checkForUpdate();
  }, [checkForUpdate]);

  const activate = useCallback(async () => {
    if (activeRef.current) {
      return;
    }

    if (
      state.status === "available" ||
      (state.status === "failed" && state.retry === "install")
    ) {
      await installCandidate();
      return;
    }

    if (
      state.status === "current" ||
      (state.status === "failed" && state.retry === "check")
    ) {
      await checkForUpdate();
    }
  }, [checkForUpdate, installCandidate, state]);

  return { state, activate };
}
