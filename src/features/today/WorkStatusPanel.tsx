import { useCallback, useEffect, useState } from "react";

import {
  getCurrentWorkStatus,
  listWorkStatuses,
  mapWorkStatusError,
  switchWorkStatus,
  type CurrentWorkStatus,
  type FixedWorkStatus,
  type WorkStatusAppError,
} from "../../services/tauri/workStatus";
import { Button } from "../../shared/ui";
import "./WorkStatusPanel.css";

export function WorkStatusPanel() {
  const [statuses, setStatuses] = useState<FixedWorkStatus[]>([]);
  const [current, setCurrent] = useState<CurrentWorkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const load = useCallback(async () => {
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
    void load();
  }, [load]);

  const onSwitch = async (statusType: string) => {
    if (switchingId || current?.statusType === statusType) {
      return;
    }

    setSwitchingId(statusType);
    setError(null);
    try {
      const next = await switchWorkStatus(statusType);
      setCurrent(next);
    } catch (caught) {
      setError(mapWorkStatusError(caught as WorkStatusAppError));
    } finally {
      setSwitchingId(null);
    }
  };

  if (loading) {
    return (
      <div
        className="work-status-panel work-status-panel--loading"
        aria-busy="true"
        aria-label="加载工作状态"
      />
    );
  }

  return (
    <section className="work-status-panel" aria-label="当前工作状态">
      {error ? (
        <div className="work-status-panel__status">
          <p role="alert">{error}</p>
          <Button variant="secondary" onClick={() => void load()}>
            重试
          </Button>
        </div>
      ) : null}

      {current ? (
        <div className="work-status-panel__current">
          <p className="work-status-panel__label">当前状态</p>
          <p className="work-status-panel__title">
            <span aria-hidden="true">{current.emoji}</span> {current.name}
          </p>
          <p className="work-status-panel__copy">{current.displayCopy}</p>
        </div>
      ) : (
        <div className="work-status-panel__current work-status-panel__current--empty">
          <p className="work-status-panel__label">当前状态</p>
          <p className="work-status-panel__hint">还没选状态，先点下面一个吧。</p>
        </div>
      )}

      <div className="work-status-panel__choices">
        <p className="work-status-panel__label">切换状态</p>
        <div className="work-status-panel__grid" role="list">
          {statuses.map((status) => {
            const isActive = current?.statusType === status.id;
            const isSwitching = switchingId === status.id;

            return (
              <button
                key={status.id}
                type="button"
                role="listitem"
                className={
                  isActive
                    ? "work-status-chip work-status-chip--active"
                    : "work-status-chip"
                }
                aria-pressed={isActive}
                disabled={Boolean(switchingId)}
                onClick={() => void onSwitch(status.id)}
              >
                <span className="work-status-chip__emoji" aria-hidden="true">
                  {status.emoji}
                </span>
                <span className="work-status-chip__name">{status.name}</span>
                {isSwitching ? (
                  <span className="work-status-chip__pending">切换中…</span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
