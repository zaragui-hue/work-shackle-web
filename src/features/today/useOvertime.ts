import { useCallback, useEffect, useRef, useState } from "react";

import {
  endOvertime,
  getActiveOvertime,
  startOvertime,
  type ActiveOvertime,
} from "../../services/tauri/overtime";
import { computeOvertimeDisplay, type OvertimeDisplay } from "./overtimeDisplay";

const POLL_INTERVAL_MS = 30_000;

type OvertimeState = {
  active: ActiveOvertime | null;
  display: OvertimeDisplay | null;
  loading: boolean;
  starting: boolean;
  ending: boolean;
  error: string | null;
};

export function useOvertime(): OvertimeState & {
  start: () => Promise<void>;
  end: () => Promise<void>;
  refresh: () => Promise<void>;
} {
  const [active, setActive] = useState<ActiveOvertime | null>(null);
  const [display, setDisplay] = useState<OvertimeDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef(false);

  const refresh = useCallback(async () => {
    if (pollingRef.current) {
      return;
    }

    pollingRef.current = true;
    try {
      const next = await getActiveOvertime();
      setActive(next);
      setDisplay(next ? computeOvertimeDisplay(next.startAtMs, Date.now()) : null);
      setError(null);
    } catch {
      setError("无法加载加班状态，请稍后重试。");
    } finally {
      pollingRef.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const intervalId = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [active, refresh]);

  useEffect(() => {
    if (!active) {
      return;
    }

    const tick = () => {
      setDisplay(computeOvertimeDisplay(active.startAtMs, Date.now()));
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [active]);

  const start = useCallback(async () => {
    setStarting(true);
    setError(null);
    try {
      const next = await startOvertime();
      setActive(next);
      setDisplay(computeOvertimeDisplay(next.startAtMs, Date.now()));
    } catch {
      setError("开启加班模式失败，请稍后重试。");
    } finally {
      setStarting(false);
    }
  }, []);

  const end = useCallback(async () => {
    setEnding(true);
    setError(null);
    try {
      await endOvertime();
      setActive(null);
      setDisplay(null);
    } catch {
      setError("结束加班失败，请稍后重试。");
    } finally {
      setEnding(false);
    }
  }, []);

  return {
    active,
    display,
    loading,
    starting,
    ending,
    error,
    start,
    end,
    refresh,
  };
}
