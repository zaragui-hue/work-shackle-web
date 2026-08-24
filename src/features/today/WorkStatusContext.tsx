import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getCurrentWorkStatus,
  listWorkStatuses,
  mapWorkStatusError,
  switchWorkStatus as persistWorkStatus,
  type CurrentWorkStatus,
  type FixedWorkStatus,
  type WorkStatusAppError,
} from "../../services/tauri/workStatus";

type WorkStatusContextValue = {
  statuses: FixedWorkStatus[];
  current: CurrentWorkStatus | null;
  loading: boolean;
  error: string | null;
  switchingId: string | null;
  reload: () => Promise<void>;
  switchStatus: (statusType: string) => Promise<CurrentWorkStatus>;
  clearError: () => void;
};

const WorkStatusContext = createContext<WorkStatusContextValue | null>(null);

export function WorkStatusProvider({ children }: { children: ReactNode }) {
  const [statuses, setStatuses] = useState<FixedWorkStatus[]>([]);
  const [current, setCurrent] = useState<CurrentWorkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fixedStatuses, activeStatus] = await Promise.all([
        listWorkStatuses(),
        getCurrentWorkStatus(),
      ]);
      setStatuses(fixedStatuses.filter((status) => status.selectable));
      setCurrent(activeStatus);
    } catch (caught) {
      setError(mapWorkStatusError(caught as WorkStatusAppError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const switchStatus = useCallback(async (statusType: string) => {
    if (!statusType) {
      throw new Error("status type is required");
    }
    if (current?.statusType === statusType) {
      return current;
    }

    setSwitchingId(statusType);
    setError(null);
    try {
      const next = await persistWorkStatus(statusType);
      setCurrent(next);
      return next;
    } catch (caught) {
      setError(mapWorkStatusError(caught as WorkStatusAppError));
      throw caught;
    } finally {
      setSwitchingId(null);
    }
  }, [current]);

  const value = useMemo<WorkStatusContextValue>(() => ({
    statuses,
    current,
    loading,
    error,
    switchingId,
    reload,
    switchStatus,
    clearError: () => setError(null),
  }), [current, error, loading, reload, statuses, switchStatus, switchingId]);

  return <WorkStatusContext.Provider value={value}>{children}</WorkStatusContext.Provider>;
}

export function useWorkStatus(): WorkStatusContextValue {
  const value = useContext(WorkStatusContext);
  if (!value) {
    throw new Error("useWorkStatus must be used inside WorkStatusProvider");
  }
  return value;
}
