import { useEffect, useState } from "react";

import {
  getWorkSchedule,
  mapSettingsError,
  type SettingsAppError,
  type WorkSchedule,
} from "../../services/tauri/settings";
import {
  computeWorkCountdown,
  type WorkCountdownDisplay,
} from "./workCountdown";

type WorkCountdownState = {
  display: WorkCountdownDisplay | null;
  loading: boolean;
  error: string | null;
};

export function useWorkCountdown(): WorkCountdownState {
  const [schedule, setSchedule] = useState<WorkSchedule | null>(null);
  const [display, setDisplay] = useState<WorkCountdownDisplay | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSchedule() {
      setLoading(true);
      setError(null);
      try {
        const next = await getWorkSchedule();
        if (cancelled) {
          return;
        }
        setSchedule(next);
        setDisplay(computeWorkCountdown(next, Date.now()));
      } catch (caught) {
        if (!cancelled) {
          setError(mapSettingsError(caught as SettingsAppError));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSchedule();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!schedule) {
      return;
    }

    const tick = () => {
      setDisplay(computeWorkCountdown(schedule, Date.now()));
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [schedule]);

  return { display, loading, error };
}
