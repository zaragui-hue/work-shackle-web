import { useEffect, useState } from "react";

import { mascotStateForDdlEmotion } from "../../assets/mascot";
import { Mascot } from "../../shared/ui";
import {
  formatOverdueDuration,
  formatRemainingUntilDeadline,
} from "./todayDisplay";
import {
  ddlEmotionLabel,
  ddlProgressFillPercent,
  formatTimeElapsedCopy,
} from "./ddlProgressDisplay";
import { useDdlProgress } from "./useDdlProgress";
import "./DdlTimeProgress.css";

type DdlTimeProgressProps = {
  plannedAtMs: number;
  deadlineAtMs?: number;
  showRemaining?: boolean;
};

export function DdlTimeProgress({
  plannedAtMs,
  deadlineAtMs,
  showRemaining = true,
}: DdlTimeProgressProps) {
  const progress = useDdlProgress(plannedAtMs, deadlineAtMs);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    if (!showRemaining || deadlineAtMs == null) {
      return;
    }

    const tick = () => {
      setNowMs(Date.now());
    };

    tick();
    const intervalId = window.setInterval(tick, 1_000);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [deadlineAtMs, showRemaining]);

  if (deadlineAtMs == null || progress == null) {
    return null;
  }

  const fillPercent = ddlProgressFillPercent(progress.progressRatio);
  const remainingText = progress.isOverdue
    ? formatOverdueDuration(deadlineAtMs, nowMs)
    : formatRemainingUntilDeadline(deadlineAtMs, nowMs);

  return (
    <div
      className={`ddl-time-progress ddl-time-progress--${progress.emotion}`}
    >
      <div
        className="ddl-time-progress__track"
        role="progressbar"
        aria-label="时间进度"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(fillPercent)}
      >
        <div
          className="ddl-time-progress__fill"
          style={{ width: `${fillPercent}%` }}
        />
      </div>
      <div className="ddl-time-progress__meta">
        <Mascot
          state={mascotStateForDdlEmotion(progress.emotion)}
          size="sm"
          className="ddl-time-progress__mascot"
        />
        <p className="ddl-time-progress__copy">
          {formatTimeElapsedCopy(progress.progressRatio)}
        </p>
        <p className="ddl-time-progress__emotion">
          {ddlEmotionLabel(progress.emotion)}
        </p>
      </div>
      {showRemaining && remainingText ? (
        <p className="ddl-time-progress__remaining">{remainingText}</p>
      ) : null}
    </div>
  );
}
