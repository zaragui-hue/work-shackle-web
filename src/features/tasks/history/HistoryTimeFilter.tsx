import { Button, Input } from "../../../shared/ui";
import {
  formatHistoryPeriodLabel,
  HISTORY_TIME_MODES,
  shiftHistoryAnchor,
  validateCustomRange,
  type HistoryFilterState,
  type HistoryTimeMode,
} from "./historyFilterModel";
import "./HistoryTimeFilter.css";

type HistoryTimeFilterProps = {
  filter: HistoryFilterState;
  onChange: (next: HistoryFilterState) => void;
};

export function HistoryTimeFilter({ filter, onChange }: HistoryTimeFilterProps) {
  const customError =
    filter.mode === "custom"
      ? validateCustomRange(filter.customStartDate, filter.customEndDate)
      : null;

  const handleModeChange = (mode: HistoryTimeMode) => {
    if (mode === filter.mode) {
      return;
    }
    onChange({ ...filter, mode });
  };

  return (
    <div className="history-time-filter">
      <div
        className="history-time-filter__modes"
        role="tablist"
        aria-label="历史时间范围"
      >
        {HISTORY_TIME_MODES.map((item) => (
          <Button
            key={item.id}
            variant={filter.mode === item.id ? "primary" : "secondary"}
            className="history-time-filter__mode-button"
            role="tab"
            aria-selected={filter.mode === item.id}
            onClick={() => handleModeChange(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {filter.mode === "custom" ? (
        <div className="history-time-filter__custom">
          <Input
            label="开始"
            type="date"
            value={filter.customStartDate}
            onChange={(event) =>
              onChange({ ...filter, customStartDate: event.target.value })
            }
          />
          <Input
            label="结束"
            type="date"
            value={filter.customEndDate}
            onChange={(event) =>
              onChange({ ...filter, customEndDate: event.target.value })
            }
          />
          {customError ? (
            <p className="history-time-filter__validation" role="alert">
              {customError}
            </p>
          ) : null}
        </div>
      ) : (
        <div className="history-time-filter__period">
          <Button
            variant="secondary"
            className="history-time-filter__nav-button"
            aria-label="上一段"
            onClick={() => onChange(shiftHistoryAnchor(filter, -1))}
          >
            ←
          </Button>
          <p className="history-time-filter__label">{formatHistoryPeriodLabel(filter)}</p>
          <Button
            variant="secondary"
            className="history-time-filter__nav-button"
            aria-label="下一段"
            onClick={() => onChange(shiftHistoryAnchor(filter, 1))}
          >
            →
          </Button>
        </div>
      )}
    </div>
  );
}
