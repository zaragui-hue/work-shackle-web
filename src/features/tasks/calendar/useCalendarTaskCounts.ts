import { useEffect, useState } from "react";

import {
  calendarTaskCountsToMap,
  queryCalendarTaskCounts,
} from "../../../services/tauri/calendar";

type UseCalendarTaskCountsResult = {
  countsByDate: Record<string, number>;
  loading: boolean;
  error: string | null;
};

export function useCalendarTaskCounts(
  startDate: string | null,
  endDate: string | null,
): UseCalendarTaskCountsResult {
  const [countsByDate, setCountsByDate] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!startDate || !endDate) {
      setCountsByDate({});
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void queryCalendarTaskCounts({ startDate, endDate })
      .then((entries) => {
        if (cancelled) {
          return;
        }
        setCountsByDate(calendarTaskCountsToMap(entries));
      })
      .catch(() => {
        if (cancelled) {
          return;
        }
        setCountsByDate({});
        setError("加载日历任务数量失败");
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [startDate, endDate]);

  return { countsByDate, loading, error };
}
