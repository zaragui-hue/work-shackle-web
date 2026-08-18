import { useCallback, useEffect, useState } from "react";

import {
  getBusyRules,
  sortBusyLevels,
  subscribeBusyRules,
  toBusyLevel,
  type BusyLevelRule,
} from "../../../services/tauri/busyRules";
import { DEFAULT_BUSY_LEVELS, type BusyLevel } from "./busyLevel";

type UseBusyRulesResult = {
  levels: readonly BusyLevel[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

function mapRulesToLevels(rules: BusyLevelRule[]): readonly BusyLevel[] {
  if (rules.length === 0) {
    return DEFAULT_BUSY_LEVELS;
  }
  return sortBusyLevels(rules).map(toBusyLevel);
}

export function useBusyRules(): UseBusyRulesResult {
  const [levels, setLevels] = useState<readonly BusyLevel[]>(DEFAULT_BUSY_LEVELS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rules = await getBusyRules();
      setLevels(mapRulesToLevels(rules));
    } catch {
      setError("忙碌规则加载失败");
      setLevels(DEFAULT_BUSY_LEVELS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeBusyRules(() => {
      void refresh();
    });
  }, [refresh]);

  return { levels, loading, error, refresh };
}
