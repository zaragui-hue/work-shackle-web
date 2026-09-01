import {
  mascotAnimationForWorkStatus,
  mascotStateForWorkStatus,
} from "../../assets/mascot";
import { Button, Mascot, Select } from "../../shared/ui";
import { useWorkStatus } from "./WorkStatusContext";
import { isManualWorkStatus } from "./workStatusOptions";
import "./WorkStatusPanel.css";

export function WorkStatusPanel({
  variant = "default",
}: {
  refreshKey?: string;
  variant?: "default" | "stage";
}) {
  const {
    statuses,
    current,
    loading,
    error,
    switchingId,
    reload,
    switchStatus,
  } = useWorkStatus();
  const selectableStatuses = statuses.filter((status) => isManualWorkStatus(status.id));
  const selectedStatus = current && !isManualWorkStatus(current.statusType)
    ? ""
    : current?.statusType ?? "";

  const onSwitch = async (statusType: string) => {
    if (!statusType || switchingId || current?.statusType === statusType) {
      return;
    }

    try {
      await switchStatus(statusType);
    } catch {
      // The shared controller keeps the previous state and exposes the error.
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
    <section
      className={`work-status-panel${variant === "stage" ? " work-status-panel--stage" : ""}`}
      aria-label="当前工作状态"
    >
      {error ? (
        <div className="work-status-panel__status">
          <p role="alert">{error}</p>
          <Button variant="secondary" onClick={() => void reload()}>
            重试
          </Button>
        </div>
      ) : null}

      <div className="work-status-panel__row">
        {current && variant !== "stage" ? (
          <Mascot
            state={mascotStateForWorkStatus(current.statusType)}
            animation={mascotAnimationForWorkStatus(current.statusType)}
            size="sm"
            className="work-status-panel__mascot"
          />
        ) : null}
        <div className="work-status-panel__fields">
          <Select
            label="当前状态"
            value={selectedStatus}
            disabled={Boolean(switchingId)}
            onChange={(event) => void onSwitch(event.target.value)}
          >
            {selectedStatus ? null : <option value="">选择精神档位</option>}
            {selectableStatuses.map((status) => (
              <option key={status.id} value={status.id}>
                {status.emoji} {status.name}
                {switchingId === status.id ? " 切换中…" : ""}
              </option>
            ))}
          </Select>
          {variant === "stage" ? null : current ? (
            <p className="work-status-panel__copy">{current.displayCopy}</p>
          ) : (
            <p className="work-status-panel__hint">下拉选一个就行。</p>
          )}
        </div>
      </div>
    </section>
  );
}
