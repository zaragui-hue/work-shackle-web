import { useCallback, useEffect, useRef, useState } from "react";

import {
  confirmNormalOffWork,
  getWorkEndState,
  type WorkEndState,
} from "../../services/tauri/workEndDecision";

const POLL_INTERVAL_MS = 30_000;

type WorkEndDecisionState = {
  state: WorkEndState | null;
  loading: boolean;
  confirming: boolean;
  error: string | null;
};

export function useWorkEndDecision(): WorkEndDecisionState & {
  confirmNormalOff: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [state, setState] = useState<WorkEndState | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (pollingRef.current) {
      return;
    }

    pollingRef.current = true;
    try {
      const next = await getWorkEndState();
      setState(next);
      setError(null);
    } catch {
      setError("无法加载下班状态，请稍后重试。");
    } finally {
      pollingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const intervalId = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refresh]);

  const confirmNormalOff = useCallback(async () => {
    setConfirming(true);
    setError(null);
    try {
      const next = await confirmNormalOffWork();
      setState(next);
    } catch {
      setError("确认正常下班失败，请稍后重试。");
    } finally {
      setConfirming(false);
    }
  }, []);

  return {
    state,
    loading,
    confirming,
    error,
    confirmNormalOff,
    refresh,
  };
}
