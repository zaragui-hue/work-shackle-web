import { useEffect, useMemo, useState } from "react";

import {
  mapTaskError,
  queryHistoryTasks,
  type HistoryTasksQueryInput,
  type Task,
  type TaskAppError,
} from "../../../services/tauri/tasks";

type UseHistoryTasksResult = {
  tasks: Task[];
  loading: boolean;
  error: string | null;
};

function historyQueryKey(query: HistoryTasksQueryInput | null): string | null {
  if (!query) {
    return null;
  }
  return [
    query.mode,
    query.anchorDate ?? "",
    query.startDate ?? "",
    query.endDate ?? "",
    query.status ?? "",
    query.priority?.toString() ?? "",
    query.contactId ?? "",
    query.keyword ?? "",
  ].join("|");
}

export function useHistoryTasks(
  query: HistoryTasksQueryInput | null,
  enabled: boolean,
): UseHistoryTasksResult {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const queryKey = useMemo(() => historyQueryKey(query), [query]);

  useEffect(() => {
    if (!enabled || !query || !queryKey) {
      setTasks([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void queryHistoryTasks(query)
      .then((result) => {
        if (cancelled) {
          return;
        }
        setTasks(result);
      })
      .catch((caught) => {
        if (cancelled) {
          return;
        }
        setTasks([]);
        setError(mapTaskError(caught as TaskAppError));
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, query, queryKey]);

  return { tasks, loading, error };
}
