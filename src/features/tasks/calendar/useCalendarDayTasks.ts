import { useEffect, useState } from "react";

import {
  queryCalendarDayTasks,
  type CalendarDayTasks,
} from "../../../services/tauri/calendar";

type UseCalendarDayTasksResult = {
  dayTasks: CalendarDayTasks | null;
  loading: boolean;
  error: string | null;
};

export function useCalendarDayTasks(
  date: string | null,
  enabled: boolean,
): UseCalendarDayTasksResult {
  const [dayTasks, setDayTasks] = useState<CalendarDayTasks | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !date) {
      setDayTasks(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void queryCalendarDayTasks({ date })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setDayTasks(result);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setDayTasks(null);
        setError("加载当天任务失败");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [date, enabled]);

  return { dayTasks, loading, error };
}
